<?php

declare(strict_types=1);

namespace App\Services\P2\Persistence;

use App\Contracts\P2\Store;
use App\Models\ActivityLog;
use App\Models\AlertAssignment;
use App\Models\AlertResponse;
use App\Models\Announcement;
use App\Models\AnnouncementHistory;
use App\Models\CapacityGuard;
use App\Models\CommunityFeedback;
use App\Models\EmergencyAlert;
use App\Models\IdempotencyRequest;
use App\Models\IncidentStatusHistory;
use App\Models\Notification;
use App\Models\OutboxEvent;
use App\Models\Rescue;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/** Explicit P2 DTO mappings over DBA models on the default caller connection. */
final class RelationalStore implements Store
{
    private const MODELS = [
        'emergency_alerts' => EmergencyAlert::class,
        'alert_assignments' => AlertAssignment::class,
        'alert_responses' => AlertResponse::class,
        'rescues' => Rescue::class,
        'incident_status_history' => IncidentStatusHistory::class,
        'announcements' => Announcement::class,
        'announcement_history' => AnnouncementHistory::class,
        'community_feedback' => CommunityFeedback::class,
        'idempotency_requests' => IdempotencyRequest::class,
        'activity_logs' => ActivityLog::class,
        'outbox_events' => OutboxEvent::class,
        'notifications' => Notification::class,
    ];

    private const FIELDS = [
        'emergency_alerts' => 'barangay_id resident_id household_id alert_type description location_label address_snapshot map_x map_y victim_count status assignment_revision reported_at acknowledged_at resolved_at acknowledged_by resolved_by created_at updated_at',
        'alert_assignments' => 'alert_id barangay_id user_id role assigned_by personnel_name assigned_by_name assigned_at status ended_by ended_at end_reason override_by override_at override_reason',
        'alert_responses' => 'alert_id assignment_id responder_id response_type response_status rescue_required notes responded_at',
        'rescues' => 'alert_id assignment_id rescuer_id facility_id destination_snapshot rescue_status notes rescued_at',
        'incident_status_history' => 'alert_id stage actor_id role_at_action occurred_at evidence sequence',
        'announcements' => 'barangay_id author_id author_role title content status published_at expires_at archived_at retracted_at retraction_reason revision created_at updated_at',
        'announcement_history' => 'announcement_id actor_id role_at_action action reason snapshot occurred_at',
        'community_feedback' => 'barangay_id resident_id kind title description category location assigned_tanod_id status rating comment submitted_at assigned_at resolved_at revision created_at',
        'idempotency_requests' => 'actor_id route key_digest request_hash http_status outcome expires_at',
        'notifications' => 'read_at dismissed_at',
    ];

    public function inTransaction(): bool
    {
        return DB::transactionLevel() > 0;
    }

    public function transaction(array $keys, \Closure $work): mixed
    {
        // Nested calls join the existing transaction. DBA guard upserts retain locks until outer commit.
        $attempts = $this->inTransaction() ? 1 : 3;

        return DB::transaction(function () use ($keys, $work) {
            $people = [];
            $sos = [];
            foreach ($keys as $key) {
                [$kind, $number] = explode(':', $key, 2);
                if ($kind === 'person') {
                    $people[] = (int) $number;
                }
                if ($kind === 'sos') {
                    $sos[] = (int) $number;
                }
            }
            CapacityGuard::lockPeople($people);
            CapacityGuard::lockPeople($sos, 'sos');
            CapacityGuard::lockRows('users', $people);
            DB::table('personnel_appointments')->whereIn('user_id', $people)->orderBy('id')->lockForUpdate()->get();
            foreach ($keys as $key) {
                [$type, $id] = explode(':', $key, 2);
                if ($type === 'sos') {
                    continue;
                } elseif ($type === 'person') {
                    continue;
                } else {
                    $table = match ($type) {
                        'incident' => 'emergency_alerts', 'facility' => 'facilities',
                        'announcement' => 'announcements', 'feedback' => 'community_feedback',
                        default => throw new \LogicException('Unsupported P2 lock.'),
                    };
                    DB::table($table)->where('id', (int) $id)->lockForUpdate()->first();
                    if ($type === 'incident') {
                        DB::table('alert_assignments')->where('alert_id', (int) $id)->orderBy('id')->lockForUpdate()->get();
                    }
                }
            }

            return $work();
        }, $attempts);
    }

    private function digest(int $actor, string $route, string $key): string
    {
        return hash_hmac('sha256', $actor.'|'.$route.'|'.$key, (string) config('app.key'));
    }

    private function model(string $table): Model
    {
        $class = self::MODELS[$table] ?? throw new \LogicException('Unsupported P2 table.');

        return new $class;
    }

    private function aliases(string $table): array
    {
        return match ($table) {
            'community_feedback' => ['type' => 'kind'],
            'announcements' => ['posted_by' => 'author_id'],
            'incident_status_history' => ['status' => 'stage', 'actor_role' => 'role_at_action'],
            'rescues' => ['facility_snapshot' => 'destination_snapshot'],
            'announcement_history' => ['by' => 'actor_id', 'at' => 'occurred_at'],
            'activity_logs' => ['actor_role' => 'role_at_action', 'created_at' => 'occurred_at'],
            'notifications' => ['user_id' => 'recipient_id'],
            default => [],
        };
    }

    private function parent(string $table): ?array
    {
        return match ($table) {
            'alert_responses', 'rescues', 'incident_status_history' => ['emergency_alerts', 'alert_id'],
            'announcement_history' => ['announcements', 'announcement_id'],
            default => null,
        };
    }

    public function select(string $table, array $where = []): array
    {
        $query = $this->model($table)->newQuery();
        foreach ($where as $key => $value) {
            if ($key === 'barangay_id' && ($parent = $this->parent($table))) {
                $query->whereIn($parent[1], DB::table($parent[0])->select('id')->where('barangay_id', $value));
            } elseif ($key === 'barangay_id' && $table === 'notifications') {
                $query->whereIn('event_id', DB::table('outbox_events')->select('event_id')->where('barangay_id', $value));
            } elseif ($table === 'idempotency_requests' && $key === 'request_key') {
                $query->where('key_digest', $this->digest($where['actor_id'], $where['route'], $value));
            } else {
                $field = $this->aliases($table)[$key] ?? $key;
                $readFields = match ($table) {
                    'notifications' => 'recipient_id kind target title description created_at',
                    'activity_logs' => 'barangay_id actor_id role_at_action resource_type resource_id action evidence occurred_at recorded_at',
                    default => '',
                };
                if (! in_array($field, ['id', 'event_id', ...explode(' ', $readFields), ...explode(' ', self::FIELDS[$table] ?? '')], true)) {
                    throw new \LogicException('Unknown P2 read field: '.$table.'.'.$key);
                }
                $query->where($field, $value);
            }
        }

        if ($this->inTransaction()) {
            $query->lockForUpdate();
        }

        return $query->orderBy('id')->get()->map(fn ($model) => $this->project($table, $model))->all();
    }

    private function project(string $table, Model $model): array
    {
        $row = $model->attributesToArray();
        foreach ($this->aliases($table) as $dto => $column) {
            $row[$dto] = $row[$column] ?? null;
        }
        foreach ($row as $key => $value) {
            if ($key !== 'event_id' && $value !== null && ($key === 'id' || str_ends_with($key, '_id') || in_array($key, ['revision', 'assignment_revision', 'rating', 'victim_count', 'sequence'], true))) {
                $row[$key] = (int) $value;
            }
            if ($value !== null && in_array($key, ['map_x', 'map_y'], true)) {
                $row[$key] = (float) $value;
            }
        }
        if ($parent = $this->parent($table)) {
            $row['barangay_id'] = (int) DB::table($parent[0])->where('id', $row[$parent[1]])->value('barangay_id');
        }
        if ($table === 'idempotency_requests') {
            $row['resource_id'] = $row['outcome']['resource_id'] ?? null;
        } elseif ($table === 'emergency_alerts') {
            $row['created_at'] = $row['reported_at'];
        } elseif ($table === 'activity_logs') {
            $row['summary'] = $row['summary']['display'] ?? $row['summary'];
        } elseif ($table === 'announcement_history') {
            $row += $row['snapshot'] ?? [];
        } elseif ($table === 'notifications') {
            $event = OutboxEvent::query()->where('event_id', $row['event_id'])->firstOrFail();
            $row += ['barangay_id' => (int) $event->barangay_id, 'resource_type' => $event->resource_type === 'alert' ? 'incident' : $event->resource_type, 'resource_id' => (int) $event->resource_id, 'audience' => str_starts_with($row['target'], 'resident-') ? 'resident' : 'official', 'channel' => 'in_app'];
            $row['link'] = $row['target'];
        }

        return $row;
    }

    private function encode(string $table, array $row): array
    {
        if ($parent = $this->parent($table)) {
            // Scope is validation metadata for a scoped DTO, never an ignored SQL column.
            $scope = $row['barangay_id'] ?? null;
            if ($scope === null || (int) DB::table($parent[0])->where('id', $row[$parent[1]] ?? null)->value('barangay_id') !== $scope) {
                throw new \LogicException('P2 parent scope mismatch.');
            }
            unset($row['barangay_id']);
        }
        foreach ($this->aliases($table) as $dto => $column) {
            if (array_key_exists($dto, $row)) {
                $row[$column] = $row[$dto];
                unset($row[$dto]);
            }
        }
        if ($table === 'incident_status_history') {
            $row['sequence'] = (int) DB::table($table)->where('alert_id', $row['alert_id'])->orderByDesc('sequence')->lockForUpdate()->value('sequence') + 1;
            $row['evidence'] = 'Recorded domain event';
        } elseif ($table === 'announcement_history') {
            $row['snapshot'] = array_intersect_key($row, array_flip(['title', 'content', 'expires_at']));
            unset($row['title'], $row['content'], $row['expires_at']);
        } elseif ($table === 'idempotency_requests') {
            $row['key_digest'] = $this->digest($row['actor_id'], $row['route'], $row['request_key']);
            $row['outcome'] = ['resource_id' => $row['resource_id']];
            $row['http_status'] = 200;
            $row['expires_at'] = now()->addDay();
            unset($row['request_key'], $row['resource_id']);
        }
        $unknown = array_diff(array_keys($row), explode(' ', self::FIELDS[$table] ?? ''));
        if ($unknown) {
            throw new \LogicException('Unknown P2 write fields: '.$table.'.'.implode(',', $unknown));
        }
        foreach ($row as $key => $value) {
            if ($value !== null && str_ends_with($key, '_at') && is_string($value)) {
                $row[$key] = (new \DateTimeImmutable($value))->setTimezone(new \DateTimeZone('UTC'));
            }
        }

        return $row;
    }

    public function insert(string $table, array $row): array
    {
        if (! $this->inTransaction()) {
            throw new \LogicException('P2 writes require the caller transaction.');
        }
        $model = $this->model($table);
        $model->forceFill($this->encode($table, $row))->save();

        return $this->project($table, $model->fresh());
    }

    public function update(string $table, int $id, array $patch): array
    {
        if (! $this->inTransaction() || ! in_array($table, ['emergency_alerts', 'alert_assignments', 'announcements', 'community_feedback', 'notifications'], true)) {
            throw new \LogicException('Invalid P2 update.');
        }
        $model = $this->model($table)->newQuery()->findOrFail($id);
        $model->forceFill($this->encode($table, $patch))->save();

        return $this->project($table, $model->fresh());
    }
}

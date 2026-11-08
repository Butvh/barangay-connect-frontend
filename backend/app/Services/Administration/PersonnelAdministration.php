<?php

namespace App\Services\Administration;

use App\Models\CapacityGuard;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Verification\PrivateDocumentUploads;
use App\Support\ApiProblem;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;

final class PersonnelAdministration
{
    private const LIMITS = ['secretary' => 3, 'responder' => 6, 'rescuer' => 6];

    public function __construct(private AdministrativeContext $context, private PrivateDocumentUploads $documents, private CommandReceipt $receipts) {}

    private function captain(EffectiveIdentity $actor): void
    {
        $this->context->identity->assertCurrent($actor);
        if ($actor->role !== 'captain') {
            throw new ApiProblem('FORBIDDEN', 403, 'Only the Barangay Captain can manage personnel.');
        }
    }

    private function transaction(EffectiveIdentity $actor, array $people, Closure $work): mixed
    {
        $this->captain($actor);
        $db = $this->context->db();
        if ($db->transactionLevel() !== 0) {
            throw new \LogicException('Start personnel commands outside an existing transaction.');
        }

        return $db->transaction(function () use ($actor, $people, $work) {
            // Capacity is shared by every appointment, including Inactive ones.
            // P2 never changes staffing; it shares the following person guards.
            CapacityGuard::lockScope('barangay', $actor->barangayId, 'staffing');

            return $this->context->store->transaction(array_map(fn ($id) => 'person:'.$id, array_unique([$actor->id, ...$people])), function () use ($actor, $work) {
                $this->context->identity->locked($actor);

                return $work();
            });
        }, 3);
    }

    private function busy(int $user, ?string $role, bool $lock = false): array
    {
        if (! in_array($role, ['responder', 'rescuer'], true)) {
            return [];
        }
        $db = $this->context->db();
        $ids = $db->table('alert_assignments')->where('user_id', $user)->where('role', $role)->where('status', 'active')->orderBy('alert_id')->pluck('alert_id')->map(fn ($v) => (int) $v)->all();
        if ($lock) {
            // No assignment can be added/reassigned while the person's operations
            // guard is held. Source locks follow all people, in ascending order.
            CapacityGuard::lockRows('emergency_alerts', $ids);
        }

        return $db->table('emergency_alerts')->whereIn('id', $ids)->where('status', '<>', 'Resolved')->orderBy('id')->pluck('id')->map(fn ($v) => (int) $v)->all();
    }

    private function person(EffectiveIdentity $actor, int $id): object
    {
        $db = $this->context->db();
        $user = $db->table('users')->where('id', $id)->where('barangay_id', $actor->barangayId)->where('is_captain', false)->first();
        if (! $user || (! $db->table('personnel_appointments')->where('user_id', $id)->exists() && ! $db->table('tanod_memberships')->where('user_id', $id)->where('barangay_id', $actor->barangayId)->exists())) {
            throw new ApiProblem('NOT_FOUND', 404, 'Personnel record is unavailable.');
        }

        return $user;
    }

    private function project(EffectiveIdentity $actor, object $user): array
    {
        $db = $this->context->db();
        $app = $db->table('personnel_appointments')->where('user_id', $user->id)->where('barangay_id', $actor->barangayId)->first();
        $tanod = $db->table('tanod_memberships')->where('user_id', $user->id)->where('barangay_id', $actor->barangayId)->exists();
        $history = $app ? $db->table('personnel_history')->where('appointment_id', $app->id)->orderBy('id')->get()->map(fn ($h) => ['action' => $h->action,
            'by' => $h->actor_id, 'by_name' => $h->actor_id ? $db->table('users')->where('id', $h->actor_id)->value('full_name') : null,
            'at' => $h->occurred_at ? CarbonImmutable::parse($h->occurred_at, 'UTC')->toISOString() : null,
            'effective_date' => $h->effective_date, 'from_role' => $h->from_role, 'to_role' => $h->to_role, 'status' => $h->status, 'notes' => $h->notes ?? ''])->all() : [];
        $requirements = $app ? $db->table('documents')->where('appointment_id', $app->id)->orderBy('id')->get()->map(fn ($d) => ['id' => (int) $d->id,
            'name' => $d->original_name, 'type' => $d->mime, 'size' => (int) $d->bytes, 'download_path' => '/api/v1/personnel/documents/'.$d->id])->all() : [];
        $busy = $this->busy((int) $user->id, $app?->role);

        return ['id' => (int) $user->id, 'user_id' => (int) $user->id, 'appointment_id' => $app ? (int) $app->id : null, 'barangay_id' => $actor->barangayId,
            'full_name' => $user->full_name, 'email' => $user->email, 'contact_number' => $user->contact_number ?? '', 'address' => $app?->address ?? '',
            'emergency_contact' => $app?->emergency_contact ?? '', 'role' => $app?->role, 'source' => $app?->source ?? ($tanod ? 'tanod' : 'existing'),
            'status' => $app?->status ?? 'Unassigned', 'appointed_at' => $app?->effective_date, 'notes' => $app?->notes ?? '', 'requirements' => $requirements,
            'history' => $history, 'revision' => (int) ($app?->revision ?? 0), 'legacy' => $app ? (bool) $app->legacy : true,
            'created_at' => $app?->created_at ?? $user->created_at, 'added_externally_at' => $app?->added_externally_at,
            'busy_alert_ids' => $busy, 'assignment_workload' => in_array($app?->role, ['responder', 'rescuer'], true) ? count($busy) : null,
            'assignment_limit' => match ($app?->role) {
                'responder' => 2, 'rescuer' => 1, default => null
            }, 'is_tanod' => $tanod];
    }

    public function list(EffectiveIdentity $actor): array
    {
        $this->captain($actor);

        return $this->context->transaction($actor, ['captain'], [], function () use ($actor) {
            $db = $this->context->db();
            $users = $db->table('users')->where('barangay_id', $actor->barangayId)->where('is_captain', false)
                ->where(fn ($q) => $q->whereIn('id', $db->table('personnel_appointments')->select('user_id')->where('barangay_id', $actor->barangayId))
                    ->orWhereIn('id', $db->table('tanod_memberships')->select('user_id')->where('barangay_id', $actor->barangayId)))->orderBy('id')->get();
            $rows = $users->map(fn ($user) => $this->project($actor, $user))->all();
            $capacities = [];
            foreach (self::LIMITS as $role => $limit) {
                $used = count(array_filter($rows, fn ($r) => $r['role'] === $role));
                $capacities[$role] = ['used' => $used, 'limit' => $limit, 'available' => max(0, $limit - $used)];
            }
            $activity = [];
            foreach ($rows as $row) {
                foreach ($row['history'] as $event) {
                    $activity[] = $event + ['personnel_id' => $row['id'], 'full_name' => $row['full_name'], 'source' => $row['source']];
                }
            }
            usort($activity, fn ($a, $b) => strcmp($b['at'] ?? '', $a['at'] ?? ''));

            return ['records' => array_values(array_filter($rows, fn ($r) => $r['role'] || $r['history'] || $r['source'] !== 'tanod')),
                'tanods' => array_values(array_filter($rows, fn ($r) => $r['is_tanod'])), 'capacities' => $capacities, 'activity' => $activity];
        });
    }

    public function get(EffectiveIdentity $actor, int $id): array
    {
        return $this->context->transaction($actor, ['captain'], [], fn () => $this->project($actor, $this->person($actor, $id)));
    }

    private function fields(array $input, bool $external, bool $remove = false): array
    {
        $rules = ['effective_date' => 'required|date_format:Y-m-d', 'notes' => 'nullable|string|max:500'];
        if (! $remove) {
            $rules['role'] = 'required|in:secretary,responder,rescuer';
        }
        if ($external) {
            $rules += ['full_name' => 'required|string|max:100', 'email' => 'required|email:rfc|max:254', 'contact_number' => ['required', 'string', 'max:30', 'regex:/^[+0-9 ().-]{7,30}$/'],
                'address' => 'required|string|max:300', 'emergency_contact' => 'required|string|max:200', 'status' => 'sometimes|in:Active,Inactive'];
        } else {
            $rules['expected_revision'] = 'required|integer|min:0';
        }
        $fields = $this->context->validate($input, $rules);
        foreach (['full_name', 'email', 'contact_number', 'address', 'emergency_contact', 'notes'] as $field) {
            if (isset($fields[$field])) {
                $fields[$field] = trim($fields[$field]);
                if ($field !== 'notes' && $fields[$field] === '') {
                    throw new ApiProblem('VALIDATION', 422, 'Complete the personnel details.');
                }
            }
        }
        if ((! $external && ! is_int($fields['expected_revision'])) || $fields['effective_date'] > now('Asia/Manila')->format('Y-m-d')) {
            throw new ApiProblem('VALIDATION', 422, 'Use the original revision and an effective date no later than today.');
        }
        if ($external && strlen(preg_replace('/\D/', '', $fields['contact_number'])) < 7) {
            throw new ApiProblem('VALIDATION', 422, 'Enter at least seven contact digits.');
        }

        return $fields;
    }

    private function capacity(int $scope, string $role): void
    {
        if ($this->context->db()->table('personnel_appointments')->where('barangay_id', $scope)->where('role', $role)->count() >= self::LIMITS[$role]) {
            throw new ApiProblem('CAPACITY', 409, 'All positions for this role are occupied, including inactive appointments.');
        }
    }

    private function history(EffectiveIdentity $actor, int $app, string $action, ?string $before, ?string $after, string $status, string $source, array $fields): void
    {
        $this->context->db()->table('personnel_history')->insert(['appointment_id' => $app, 'action' => $action, 'from_role' => $before, 'to_role' => $after,
            'status' => $status, 'source' => $source, 'effective_date' => $fields['effective_date'], 'actor_id' => $actor->id, 'role_at_action' => $actor->role,
            'notes' => $fields['notes'] ?? '', 'occurred_at' => now('UTC'), 'recorded_at' => now('UTC')]);
    }

    public function addExternal(EffectiveIdentity $actor, array $input, array $files, string $key): array
    {
        $this->captain($actor);
        if (! preg_match('/^[A-Za-z0-9_-]{8,128}$/D', $key)) {
            throw new ApiProblem('VALIDATION', 422, 'Use a valid original command key.');
        }
        $fields = $this->fields($input, true);
        $fields['email'] = mb_strtolower($fields['email']);
        if (count($files) > 10) {
            throw new ApiProblem('VALIDATION', 422, 'Choose up to ten requirement files.');
        }
        $password = Hash::make(bin2hex(random_bytes(64))); // Never a shared/demo password.
        $staged = [];
        try {
            foreach ($files as $file) {
                if (! $file instanceof UploadedFile) {
                    throw new ApiProblem('VALIDATION', 422, 'Upload actual requirement files.');
                }
                $staged[] = $this->documents->stage($file, 5242880, 'personnel_requirement');
            }
            $outcome = $this->transaction($actor, [], function () use ($actor, $fields, $staged, $key, $password) {
                $body = ['fields' => $fields, 'files' => array_map(fn ($f) => array_intersect_key($f, array_flip(['input_sha256', 'original_name', 'kind'])), $staged)];

                return $this->receipts->once($actor->id, 'p1:personnel.external', $key, $body, function () use ($actor, $fields, $staged, $password) {
                    $db = $this->context->db();
                    $this->capacity($actor->barangayId, $fields['role']);
                    $userId = $db->table('users')->insertGetId(['full_name' => $fields['full_name'], 'email' => $fields['email'], 'password' => $password,
                        'contact_number' => $fields['contact_number'], 'barangay_id' => $actor->barangayId, 'is_resident' => false, 'is_captain' => false,
                        'account_status' => 'Active', 'auth_version' => 0, 'created_at' => now('UTC'), 'updated_at' => now('UTC')]);
                    // Newly inserted identity is uncommitted and cannot be a
                    // concurrent operations target; no existing person is locked late.
                    $status = $fields['status'] ?? 'Active';
                    $app = $db->table('personnel_appointments')->insertGetId(['user_id' => $userId, 'barangay_id' => $actor->barangayId, 'role' => $fields['role'],
                        'status' => $status, 'source' => 'external', 'effective_date' => $fields['effective_date'], 'assigned_by' => $actor->id,
                        'address' => $fields['address'], 'emergency_contact' => $fields['emergency_contact'], 'notes' => $fields['notes'] ?? '',
                        'legacy' => false, 'revision' => 1, 'added_externally_at' => now('UTC'), 'created_at' => now('UTC'), 'updated_at' => now('UTC')]);
                    foreach ($staged as $file) {
                        $this->documents->attach($file, $actor->barangayId, $actor->id, appointment: $app);
                    }
                    $this->history($actor, $app, 'Added', null, $fields['role'], $status, 'external', $fields);
                    $this->context->record($actor, 'personnel_appointment', $app, 'personnel.updated.v2', ['role' => $fields['role'], 'status' => $status], 'Personnel added',
                        ['status' => $status, 'user_id' => $userId, 'revision' => 1], [$actor->id, $userId]);

                    return ['id' => $userId];
                });
            });
        } catch (QueryException $error) {
            if (($error->errorInfo[1] ?? null) === 1062 && $this->context->db()->table('users')->where('email', $fields['email'])->exists()) {
                throw new ApiProblem('VALIDATION', 422, 'This email is already registered.', ['email' => 'Use the existing account.']);
            }
            throw $error;
        } finally {
            foreach ($staged as $file) {
                $this->documents->release($file);
            }
        }

        return $this->get($actor, $outcome['id']);
    }

    public function change(EffectiveIdentity $actor, int $id, string $action, array $input): array
    {
        if (! in_array($action, ['appoint', 'reassign', 'remove'], true)) {
            throw new ApiProblem('VALIDATION', 422, 'Choose a supported personnel action.');
        }
        $fields = $this->fields($input, false, $action === 'remove');
        $this->transaction($actor, [$id], function () use ($actor, $id, $action, $fields) {
            $db = $this->context->db();
            $user = $this->person($actor, $id);
            $app = $db->table('personnel_appointments')->where('user_id', $id)->where('barangay_id', $actor->barangayId)->lockForUpdate()->first();
            $this->context->revision($app ?? (object) ['revision' => 0], $fields['expected_revision']);
            $oldRole = $app?->role;
            $minimum = $app ? $db->table('personnel_history')->where('appointment_id', $app->id)->orderByDesc('id')->value('effective_date') : null;
            $minimum ??= $app?->effective_date;
            if ($minimum && $fields['effective_date'] < $minimum) {
                throw new ApiProblem('VALIDATION', 422, 'The effective date cannot precede the current appointment history.');
            }
            if ($action === 'appoint') {
                $tanod = $db->table('tanod_memberships')->where('user_id', $id)->where('barangay_id', $actor->barangayId)->where('active', true)->exists();
                if (! $tanod || $oldRole !== null || $user->account_status !== 'Active') {
                    throw new ApiProblem('CONFLICT', 409, 'Only an active, unassigned member of the fixed Tanod pool can be appointed.');
                }
            } elseif ($oldRole === null) {
                throw new ApiProblem('CONFLICT', 409, 'This person has no assigned role.');
            }
            $next = $action === 'remove' ? null : $fields['role'];
            if ($next === $oldRole) {
                throw new ApiProblem('VALIDATION', 422, 'Choose a different role.');
            }
            if ($this->busy($id, $oldRole, true)) {
                throw new ApiProblem('BUSY', 409, 'Complete, reassign or cancel unresolved responsibilities before changing this role.');
            }
            if ($next !== null) {
                $this->capacity($actor->barangayId, $next);
            }
            $status = $next === null ? 'Unassigned' : ($action === 'appoint' ? 'Active' : $app->status);
            $source = $app?->source ?? 'tanod';
            $values = ['role' => $next, 'status' => $status, 'source' => $source, 'effective_date' => $fields['effective_date'],
                'assigned_by' => $actor->id, 'notes' => $fields['notes'] ?? '', 'revision' => (int) ($app?->revision ?? 0) + 1, 'updated_at' => now('UTC')];
            if ($app) {
                $appId = (int) $app->id;
                $db->table('personnel_appointments')->where('id', $appId)->update($values);
            } else {
                $appId = $db->table('personnel_appointments')->insertGetId($values + ['user_id' => $id, 'barangay_id' => $actor->barangayId, 'created_at' => now('UTC')]);
            }
            $db->table('users')->where('id', $id)->update(['auth_version' => $user->auth_version + 1, 'remember_token' => null, 'updated_at' => now('UTC')]);
            $db->table('password_recovery_challenges')->where('user_id', $id)->whereNull('consumed_at')->update(['superseded_at' => now('UTC'), 'updated_at' => now('UTC')]);
            $this->history($actor, $appId, ['appoint' => 'Appointed', 'reassign' => 'Reassigned', 'remove' => 'Removed'][$action], $oldRole, $next, $status, $source, $fields);
            $this->context->record($actor, 'personnel_appointment', $appId, 'personnel.updated.v2', ['role' => $next, 'status' => $status], 'Personnel role changed',
                ['status' => $status, 'user_id' => $id, 'revision' => $values['revision']], [$actor->id, $id]);
        });

        return $this->get($actor, $id);
    }

    public function document(EffectiveIdentity $actor, int $id): object
    {
        return $this->context->transaction($actor, ['captain'], [], function () use ($actor, $id) {
            $db = $this->context->db();
            $doc = $db->table('documents')->where('id', $id)->where('barangay_id', $actor->barangayId)->whereNotNull('appointment_id')->first();
            if (! $doc || ! $db->table('personnel_appointments')->where('id', $doc->appointment_id)->where('barangay_id', $actor->barangayId)->exists()) {
                throw new ApiProblem('NOT_FOUND', 404, 'Private personnel document is unavailable.');
            }

            return $doc;
        });
    }
}

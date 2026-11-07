<?php

namespace App\Services\Photos;

use App\Support\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Metadata-only claims/finalization surround byte deletion; tombstones are never pruned. */
final class PhotoCleanup
{
    public function __construct(private PrivatePhotoObjects $objects) {}

    private function db(): Connection
    {
        $db = DB::connection(config('integration.connection', 'mysql'));
        if ($db->transactionLevel() !== 0 || $db->getDriverName() !== 'mysql' || $db->getName() !== config('database.default')) {
            throw new \LogicException('Cleanup must start outside transactions on the shared MySQL connection.');
        }

        return $db;
    }

    public function claim(int $id): ?object
    {
        $db = $this->db();

        return $db->transaction(function () use ($db, $id): ?object {
            $now = CarbonImmutable::now('UTC');
            $row = $db->table('incident_photos')->where('id', $id)->lockForUpdate()->first();
            if (! $row || $row->incident_id !== null || in_array($row->state, ['attached', 'removed'], true) ||
                $row->expires_at > $now->format('Y-m-d H:i:s.u') || $row->cleanup_attempts >= 20 ||
                ($row->state === 'removing' && $row->cleanup_lease_until > $now->format('Y-m-d H:i:s.u')) ||
                ($row->failure_code === 'cleanup_failed' && $row->updated_at > $now->subMinutes(5)->format('Y-m-d H:i:s.u'))) {
                return null;
            }
            $db->table('incident_photos')->where('id', $id)->update(['state' => 'removing', 'cleanup_token' => (string) Str::uuid(),
                'cleanup_attempts' => $row->cleanup_attempts + 1, 'cleanup_lease_until' => $now->addMinutes(5), 'updated_at' => $now]);

            return $db->table('incident_photos')->where('id', $id)->first();
        });
    }

    public function finalize(int $id, string $token, bool $removed): bool
    {
        $db = $this->db();

        return $db->transaction(function () use ($db, $id, $token, $removed): bool {
            $row = $db->table('incident_photos')->where('id', $id)->lockForUpdate()->first();
            $now = CarbonImmutable::now('UTC');
            if (! $row || $row->state !== 'removing' || ! hash_equals($row->cleanup_token, $token) ||
                $row->cleanup_lease_until <= $now->format('Y-m-d H:i:s.u')) {
                return false;
            }
            $db->table('incident_photos')->where('id', $id)->update(['state' => $removed ? 'removed' : 'failed',
                'cleanup_token' => null, 'cleanup_lease_until' => null, 'updated_at' => $now] +
                ($removed ? ['removed_at' => $now] : ['failed_at' => $now, 'failure_code' => 'cleanup_failed']));

            return true;
        });
    }

    public function run(int $limit = 20): array
    {
        $db = $this->db();
        $ids = $db->table('incident_photos')->whereNull('incident_id')->whereIn('state', ['processing', 'ready', 'failed', 'removing'])
            ->where('expires_at', '<=', now('UTC'))->where('cleanup_attempts', '<', 20)
            ->where(fn ($query) => $query->where('state', '<>', 'removing')->orWhere('cleanup_lease_until', '<=', now('UTC')))
            ->where(fn ($query) => $query->whereNull('failure_code')->orWhere('failure_code', '<>', 'cleanup_failed')->orWhere('updated_at', '<=', now('UTC')->subMinutes(5)))
            ->orderBy('id')->limit(max(1, min(100, $limit)))->pluck('id');
        $result = ['claimed' => 0, 'removed' => 0, 'failed' => 0, 'stale' => 0];
        foreach ($ids as $id) {
            $row = $this->claim((int) $id);
            if (! $row) {
                continue;
            }
            $result['claimed']++;
            try {
                $this->objects->remove($row->object_key); // No transaction/people/source locks held.
                $removed = true;
            } catch (ApiProblem) {
                $removed = false;
            }
            $accepted = $this->finalize((int) $row->id, $row->cleanup_token, $removed);
            $result[$accepted ? ($removed ? 'removed' : 'failed') : 'stale']++;
        }

        return $result;
    }
}

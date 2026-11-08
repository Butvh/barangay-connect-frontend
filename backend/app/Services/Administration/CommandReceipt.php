<?php

namespace App\Services\Administration;

use App\Support\ApiProblem;
use Closure;

/** Frozen P1 command receipts join the caller's already ordered source transaction. */
final class CommandReceipt
{
    public function __construct(private AdministrativeContext $context) {}

    public function once(int $actor, string $route, string $key, array $body, Closure $work): array
    {
        if (! preg_match('/^[A-Za-z0-9_-]{8,128}$/D', $key) || ! str_starts_with($route, 'p1:') || strlen($route) > 100) {
            throw new ApiProblem('VALIDATION', 422, 'Use a valid original command key.');
        }
        $db = $this->context->db();
        if ($db->transactionLevel() < 1) {
            throw new \LogicException('Command receipt requires the caller source transaction.');
        }
        $digest = hash_hmac('sha256', $key, config('app.key'));
        $hash = hash_hmac('sha256', json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES), config('app.key'));
        $query = $db->table('idempotency_requests')->where(['actor_id' => $actor, 'route' => $route, 'key_digest' => $digest]);
        $existing = (clone $query)->lockForUpdate()->first();
        if ($existing) {
            if (! hash_equals($existing->request_hash, $hash)) {
                throw new ApiProblem('CONFLICT', 409, 'This command key belongs to different original input.');
            }
            // Retained receipts remain frozen after their retry window. Never
            // recycle a key and create a second source operation after expiry.
            if (! $existing->outcome) {
                throw new ApiProblem('CONFLICT', 409, 'This original command is incomplete.');
            }

            return json_decode($existing->outcome, true, flags: JSON_THROW_ON_ERROR);
        }
        $id = $db->table('idempotency_requests')->insertGetId(['actor_id' => $actor, 'route' => $route, 'key_digest' => $digest,
            'request_hash' => $hash, 'expires_at' => now('UTC')->addDay(), 'created_at' => now('UTC'), 'updated_at' => now('UTC')]);
        $result = $work();
        $db->table('idempotency_requests')->where('id', $id)->update(['outcome' => json_encode($result, JSON_THROW_ON_ERROR), 'http_status' => 200, 'updated_at' => now('UTC')]);

        return $result;
    }
}

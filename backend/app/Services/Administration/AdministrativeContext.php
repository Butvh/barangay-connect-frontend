<?php

namespace App\Services\Administration;

use App\Contracts\Events\AuditRecorder;
use App\Contracts\Events\AuditSummary;
use App\Contracts\Events\EventContext;
use App\Contracts\Events\EventId;
use App\Contracts\Events\OutboxWriter;
use App\Contracts\Events\RecipientReference;
use App\Contracts\Events\ResourceReference;
use App\Contracts\P2\Store;
use App\Models\User;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Support\ApiProblem;
use Closure;
use DateTimeImmutable;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/** P1 source-unit helpers; persistence still uses the single actual P2 audit/outbox adapters. */
final class AdministrativeContext
{
    public function __construct(public Store $store, public IdentityReferences $identity,
        private AuditRecorder $audit, private OutboxWriter $outbox) {}

    public function db(): Connection
    {
        $db = DB::connection(config('integration.connection', 'mysql'));
        if ($db->getName() !== config('database.default') || $db->getDriverName() !== 'mysql') {
            throw new \LogicException('Administration requires the shared named MySQL connection.');
        }

        return $db;
    }

    public function transaction(EffectiveIdentity $actor, array $roles, array $keys, Closure $work): mixed
    {
        if ($this->db()->transactionLevel() !== 0) {
            throw new \LogicException('Start a P1 administrative command outside any existing source transaction.');
        }

        return $this->store->transaction(['person:'.$actor->id, ...$keys], function () use ($actor, $roles, $work) {
            $this->identity->locked($actor);
            if (! in_array($actor->role, $roles, true)) {
                throw new ApiProblem('FORBIDDEN', 403, 'This administration action is unavailable for your role.');
            }

            return $work();
        });
    }

    public function validate(array $input, array $rules): array
    {
        if (array_diff(array_keys($input), array_keys($rules))) {
            throw new ApiProblem('VALIDATION', 422, 'Unexpected or protected fields were supplied.');
        }

        return Validator::make($input, $rules)->validate();
    }

    public function revision(object $row, mixed $expected): void
    {
        if (! is_int($expected) || $expected < 0) {
            throw new ApiProblem('VALIDATION', 422, 'Use the original record revision.');
        }
        if ((int) $row->revision !== $expected) {
            throw new ApiProblem('CONFLICT', 409, 'This record changed. Refresh and review the original command.');
        }
    }

    public function record(EffectiveIdentity $actor, string $resource, int $id, string $type, array $payload,
        string $action, array $summary, array $recipientIds): void
    {
        $this->audit->record($actor->id, $actor->role, $actor->barangayId, new ResourceReference($resource, $id), $action, new AuditSummary($summary));
        $this->event($actor, $id, $type, $payload, $recipientIds);
    }

    public function event(EffectiveIdentity $actor, int $id, string $type, array $payload, array $recipientIds): void
    {
        $refs = [];
        foreach (array_unique($recipientIds) as $userId) {
            $user = User::on($this->db()->getName())->where('id', $userId)->where('barangay_id', $actor->barangayId)->with('appointment')->first();
            $current = $user ? EffectiveIdentity::fromUser($user) : null;
            if ($current) {
                $refs[] = new RecipientReference($current->id, true, false, $current->role === 'resident' ? 'resident' : 'official');
            }
        }
        $this->outbox->record(new EventId((string) Str::uuid()), $type, $actor->barangayId, $id, $refs,
            new DateTimeImmutable('now', new \DateTimeZone('UTC')), EventContext::forEvent($type, $payload));
    }

    public function administrators(int $scope): array
    {
        return User::on($this->db()->getName())->where('barangay_id', $scope)->with('appointment')->get()
            ->filter(fn ($user) => in_array(EffectiveIdentity::fromUser($user)?->role, ['captain', 'secretary'], true))->pluck('id')->all();
    }
}

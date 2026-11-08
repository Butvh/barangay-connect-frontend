<?php

namespace App\Services\Identity;

use App\Contracts\Events\AuditRecorder;
use App\Contracts\Events\AuditSummary;
use App\Contracts\Events\ResourceReference;
use App\Contracts\P2\Store;
use App\Support\ApiProblem;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Database\Connection;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/** Actual purpose/version consent authority. No source audience, provider or phone DTO is fabricated. */
final class CurrentSmsConsent implements SmsDeliveryEligibility, SmsEligibilityReferences
{
    public const POLICY = 'sms-consent.v1';

    public const TEMPLATES = ['incident_review' => 'alert-review.v1', 'barangay_announcements' => 'announcement-review.v1'];

    public function __construct(private Store $store, private IdentityReferences $identity, private AuditRecorder $audit) {}

    private function outside(): Connection
    {
        $db = DB::connection(config('integration.connection', 'mysql'));
        if ($db->transactionLevel() !== 0) {
            throw new \LogicException('Current consent must start outside every existing source transaction.');
        }
        if (! config('identity.enabled') || $db->getDriverName() !== 'mysql' || $db->getName() !== config('database.default') ||
            ! $db->getSchemaBuilder()->hasTable('notification_preferences')) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Current consent authority is unavailable.');
        }

        return $db;
    }

    private function purpose(string $purpose): void
    {
        if (! isset(self::TEMPLATES[$purpose])) {
            throw new ApiProblem('VALIDATION', 422, 'Choose a supported notification purpose.');
        }
    }

    private function eligibleRole(EffectiveIdentity $recipient, string $purpose): bool
    {
        return in_array($recipient->role, $purpose === 'incident_review' ? ['captain', 'secretary'] : ['resident', 'captain', 'secretary'], true);
    }

    private function row(Connection $db, EffectiveIdentity $recipient, string $purpose): ?object
    {
        return $db->table('notification_preferences')->where('user_id', $recipient->id)->where('barangay_id', $recipient->barangayId)
            ->where('purpose', $purpose)->where('channel', 'sms')->lockForUpdate()->first();
    }

    private function granted(?object $row, string $purpose): bool
    {
        return $row && $row->state === 'granted' && $row->granted_at !== null && $row->revoked_at === null &&
            $row->policy_version === self::POLICY && $row->template_version === self::TEMPLATES[$purpose] && $row->revision >= 1;
    }

    public function allows(EffectiveIdentity $recipient, string $purpose): bool
    {
        return $this->withCurrentEligibility($recipient, $purpose, static fn (): bool => true);
    }

    public function withCurrentEligibility(EffectiveIdentity $recipient, string $purpose, Closure $reserve): bool
    {
        $db = $this->outside();
        if (! isset(self::TEMPLATES[$purpose])) {
            return false;
        }
        try {
            return $this->store->transaction(['person:'.$recipient->id], function () use ($db, $recipient, $purpose, $reserve): bool {
                $this->identity->locked($recipient);
                if (! $this->eligibleRole($recipient, $purpose)) {
                    return false;
                }
                $row = $this->row($db, $recipient, $purpose);
                if (! $this->granted($row, $purpose)) {
                    return false;
                }

                return $reserve((int) $row->revision, $row->policy_version, $row->template_version);
            });
        } catch (ApiProblem $error) {
            if (in_array($error->errorCode, ['AUTH', 'FORBIDDEN'], true)) {
                return false;
            }
            throw $error;
        }
    }

    private function projection(?object $row, string $purpose): array
    {
        return ['purpose' => $purpose, 'channel' => 'sms', 'state' => $row?->state ?? 'not_granted', 'revision' => (int) ($row?->revision ?? 0),
            'policy_version' => $row?->policy_version ?? self::POLICY, 'template_version' => $row?->template_version ?? self::TEMPLATES[$purpose],
            'granted_at' => $row?->granted_at ? CarbonImmutable::parse($row->granted_at, 'UTC')->toISOString() : null,
            'revoked_at' => $row?->revoked_at ? CarbonImmutable::parse($row->revoked_at, 'UTC')->toISOString() : null];
    }

    public function read(EffectiveIdentity $observed, string $purpose): array
    {
        $db = $this->outside();
        $this->purpose($purpose);

        return $this->store->transaction(['person:'.$observed->id], function () use ($db, $observed, $purpose): array {
            $this->identity->locked($observed);

            return $this->projection($this->row($db, $observed, $purpose), $purpose);
        });
    }

    public function change(EffectiveIdentity $observed, string $purpose, array $input): array
    {
        $db = $this->outside();
        $this->purpose($purpose);
        if (array_diff(array_keys($input), ['state', 'expected_revision', 'policy_version', 'template_version']) ||
            ! in_array($input['state'] ?? null, ['granted', 'revoked'], true) || ! is_int($input['expected_revision'] ?? null) ||
            $input['expected_revision'] < 0 || $input['expected_revision'] >= 9007199254740991 ||
            ($input['policy_version'] ?? null) !== self::POLICY || ($input['template_version'] ?? null) !== self::TEMPLATES[$purpose]) {
            throw new ApiProblem('VALIDATION', 422, 'Use the current purpose, versions and original preference revision.');
        }
        try {
            return $this->store->transaction(['person:'.$observed->id], function () use ($db, $observed, $purpose, $input): array {
                $this->identity->locked($observed);
                if ($input['state'] === 'granted' && ! $this->eligibleRole($observed, $purpose)) {
                    throw new ApiProblem('FORBIDDEN', 403, 'This notification purpose is not available for your role.');
                }
                $row = $this->row($db, $observed, $purpose);
                if ((int) ($row?->revision ?? 0) !== $input['expected_revision']) {
                    throw new ApiProblem('CONFLICT', 409, 'This preference changed. Refresh and review it.');
                }
                $now = now('UTC');
                $patch = ['state' => $input['state'], 'revision' => $input['expected_revision'] + 1,
                    'policy_version' => self::POLICY, 'template_version' => self::TEMPLATES[$purpose], 'updated_at' => $now,
                    'granted_at' => $input['state'] === 'granted' ? $now : $row?->granted_at,
                    'revoked_at' => $input['state'] === 'revoked' ? $now : null];
                if ($row) {
                    if ($db->table('notification_preferences')->where('id', $row->id)->where('revision', $input['expected_revision'])->update($patch) !== 1) {
                        throw new ApiProblem('CONFLICT', 409, 'This preference changed. Refresh and review it.');
                    }
                    $id = (int) $row->id;
                } else {
                    $id = $db->table('notification_preferences')->insertGetId($patch + ['user_id' => $observed->id,
                        'barangay_id' => $observed->barangayId, 'purpose' => $purpose, 'channel' => 'sms', 'recorded_by' => $observed->id, 'created_at' => $now]);
                }
                $reason = json_encode(['preference_id' => $id, 'purpose' => $purpose, 'channel' => 'sms', 'from' => $row?->state ?? 'not_granted',
                    'to' => $patch['state'], 'policy_version' => self::POLICY, 'template_version' => self::TEMPLATES[$purpose]], JSON_THROW_ON_ERROR);
                $this->audit->record($observed->id, $observed->role, $observed->barangayId, new ResourceReference('user', $observed->id),
                    'notification_preference.changed', new AuditSummary(['status' => $patch['state'], 'revision' => $patch['revision'], 'reason' => $reason]));

                return $this->projection($this->row($db, $observed, $purpose), $purpose);
            });
        } catch (QueryException $error) {
            if (($error->errorInfo[1] ?? null) === 1062) {
                throw new ApiProblem('CONFLICT', 409, 'This preference changed. Refresh and review it.');
            }
            throw $error;
        }
    }
}

<?php

namespace App\Services\Identity;

use App\Jobs\DeliverLocalRecoveryCode;
use App\Models\User;
use App\Services\Administration\AdministrativeContext;
use App\Support\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

/** Actual challenge authority; local mail acceptance is a separate opt-in boundary. */
final class PasswordRecovery
{
    public function __construct(private AdministrativeContext $context) {}

    public function available(): void
    {
        if (! config('integration.admin_test_bindings') || ! config('identity.local_recovery_mail') ||
            config('mail.mailers.p1-local-recovery.transport') !== 'smtp' || config('mail.mailers.p1-local-recovery.host') !== '127.0.0.1' ||
            config('mail.mailers.p1-local-recovery.url') || (int) config('mail.mailers.p1-local-recovery.port') < 1024 ||
            (int) config('mail.mailers.p1-local-recovery.port') > 65535 ||
            config('queue.connections.p1-recovery.driver') !== 'database' ||
            config('queue.connections.p1-recovery.connection') !== config('integration.connection') ||
            config('queue.connections.p1-recovery.after_commit') !== false) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'A reviewed local recovery mail service is not configured.');
        }
    }

    public function digest(string $value): string
    {
        return hash_hmac('sha256', 'p1-recovery:'.$value, config('app.key'));
    }

    public function portal(User $user, string $emailDigest): ?string
    {
        $identity = EffectiveIdentity::fromUser($user);
        if (! $identity) {
            return null;
        }
        $portal = $identity->role === 'resident' ? 'resident' : 'official';

        return hash_equals($emailDigest, $this->digest($portal.'|'.$user->email)) ? $portal : null;
    }

    private function outside(): void
    {
        $this->available();
        if ($this->context->db()->transactionLevel() !== 0) {
            throw new \LogicException('Recovery commands start outside existing source transactions.');
        }
    }

    public function request(array $input): array
    {
        $this->outside();
        $fields = $this->context->validate($input, ['email' => 'required|string|email:rfc|max:254', 'portal' => 'required|in:resident,official']);
        $email = mb_strtolower(trim($fields['email']));
        $digest = $this->digest($fields['portal'].'|'.$email);
        $observed = $this->context->db()->table('users')->where('email', $email)->first(['id']);
        $id = (string) Str::uuid();
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $this->context->store->transaction($observed ? ['person:'.$observed->id] : [], function () use ($observed, $digest, $fields, $code, $id) {
            $db = $this->context->db();
            $last = $db->table('password_recovery_challenges')->where('email_digest', $digest)->orderByDesc('created_at')->lockForUpdate()->first();
            if ($last && CarbonImmutable::parse($last->resend_available_at, 'UTC')->isAfter(now('UTC'))) {
                throw new ApiProblem('RATE_LIMIT', 429, 'Wait before requesting another code.');
            }
            $user = $observed ? User::on($db->getName())->with('appointment')->find($observed->id) : null;
            $eligible = $user && $this->portal($user, $digest) === $fields['portal'];
            // Same response, random code, durable challenge and encrypted queued
            // job for known, unknown and ineligible addresses. No log mailer.
            $db->table('password_recovery_challenges')->where(function ($q) use ($digest, $user, $eligible) {
                $q->where('email_digest', $digest);
                if ($eligible) {
                    $q->orWhere('user_id', $user->id);
                }
            })->whereNull('consumed_at')->whereNull('superseded_at')->update(['superseded_at' => now('UTC'), 'updated_at' => now('UTC')]);
            $now = now('UTC');
            $db->table('password_recovery_challenges')->insert(['id' => $id, 'user_id' => $eligible ? $user->id : null, 'email_digest' => $digest,
                'code_digest' => $this->digest($id.'|'.$code), 'expires_at' => $now->copy()->addMinutes(10), 'resend_available_at' => $now->copy()->addSeconds(60),
                'failed_attempts' => 0, 'max_attempts' => 5, 'created_at' => $now, 'updated_at' => $now]);
            Queue::connection('p1-recovery')->push(new DeliverLocalRecoveryCode($id, $code));
        });

        return ['accepted' => true, 'challenge_id' => $id, 'expires_in' => 600, 'retry_after' => 60];
    }

    public function verify(array $input): array
    {
        $this->outside();
        $fields = $this->context->validate($input, ['challenge_id' => 'required|uuid', 'code' => ['required', 'string', 'regex:/^[0-9]{6}$/D']]);
        $db = $this->context->db();
        $observed = $db->table('password_recovery_challenges')->where('id', $fields['challenge_id'])->first(['user_id']);
        $authorization = bin2hex(random_bytes(32));
        $result = $this->context->store->transaction($observed?->user_id ? ['person:'.$observed->user_id] : [], function () use ($fields, $authorization, $db) {
            $row = $db->table('password_recovery_challenges')->where('id', $fields['challenge_id'])->lockForUpdate()->first();
            if (! $row || $row->superseded_at || $row->consumed_at || $row->verified_at || $row->failed_attempts >= 5) {
                return 'INVALID_CODE';
            }
            if (! CarbonImmutable::parse($row->expires_at, 'UTC')->isAfter(now('UTC'))) {
                return 'CODE_EXPIRED';
            }
            $user = $row->user_id ? User::on($db->getName())->with('appointment')->find($row->user_id) : null;
            $valid = hash_equals($row->code_digest, $this->digest($row->id.'|'.$fields['code']));
            if (! $valid || ! $user || ! $this->portal($user, $row->email_digest)) {
                $db->table('password_recovery_challenges')->where('id', $row->id)->update(['failed_attempts' => $row->failed_attempts + 1, 'updated_at' => now('UTC')]);

                return 'INVALID_CODE'; // Commit the attempt before returning an API error.
            }
            $db->table('password_recovery_challenges')->where('id', $row->id)->update(['verified_at' => now('UTC'), 'authorization_digest' => $this->digest('authorization|'.$authorization),
                'authorization_expires_at' => now('UTC')->addMinutes(10), 'updated_at' => now('UTC')]);

            return null;
        });
        if ($result) {
            throw new ApiProblem($result, 422, $result === 'CODE_EXPIRED' ? 'This code expired. Request another code.' : 'This code is invalid or unavailable.');
        }

        return ['verified' => true, 'reset_authorization' => $authorization, 'expires_in' => 600];
    }

    public function reset(array $input): array
    {
        $this->outside();
        $fields = $this->context->validate($input, ['reset_authorization' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/D'],
            'password' => ['required', 'string', 'min:8', 'max:128', 'regex:/[A-Z]/', 'regex:/[a-z]/', 'regex:/[0-9]/', 'confirmed'],
            'password_confirmation' => 'required|string|max:128']);
        $digest = $this->digest('authorization|'.$fields['reset_authorization']);
        $db = $this->context->db();
        $observed = $db->table('password_recovery_challenges')->where('authorization_digest', $digest)->first(['id', 'user_id']);
        $hash = Hash::make($fields['password']);
        $result = $this->context->store->transaction($observed?->user_id ? ['person:'.$observed->user_id] : [], function () use ($db, $observed, $digest, $hash, $fields) {
            $row = $observed ? $db->table('password_recovery_challenges')->where('id', $observed->id)->lockForUpdate()->first() : null;
            if (! $row || ! $row->user_id || ! $row->verified_at || $row->superseded_at || $row->consumed_at || ! $row->authorization_digest ||
                ! hash_equals($row->authorization_digest, $digest) || ! $row->authorization_expires_at || ! CarbonImmutable::parse($row->authorization_expires_at, 'UTC')->isAfter(now('UTC'))) {
                return 'AUTHORIZATION_EXPIRED';
            }
            $user = User::on($db->getName())->with('appointment')->find($row->user_id);
            $identity = $user ? EffectiveIdentity::fromUser($user) : null;
            if (! $identity || ! $this->portal($user, $row->email_digest)) {
                return 'AUTHORIZATION_EXPIRED';
            }
            if (Hash::check($fields['password'], $user->password)) {
                return 'SAME_PASSWORD';
            }
            $db->table('users')->where('id', $user->id)->update(['password' => $hash, 'auth_version' => $user->auth_version + 1, 'remember_token' => null, 'updated_at' => now('UTC')]);
            $db->table('password_recovery_challenges')->where('user_id', $user->id)->whereNull('consumed_at')->update(['superseded_at' => now('UTC'), 'updated_at' => now('UTC')]);
            $db->table('password_recovery_challenges')->where('id', $row->id)->update(['consumed_at' => now('UTC'), 'updated_at' => now('UTC')]);
            // Identity is derived from the new source generation, never from a public portal label.
            $current = EffectiveIdentity::fromUser($user->fresh());
            $this->context->record($current, 'user', $user->id, 'security.updated.v2', ['action' => 'password_reset'], 'Password reset', ['status' => 'password_reset'], [$user->id]);

            return null;
        });
        if ($result) {
            throw new ApiProblem($result === 'SAME_PASSWORD' ? 'VALIDATION' : $result, 422, $result === 'SAME_PASSWORD' ? 'Choose a password different from the current password.' : 'Recovery authorization is invalid or expired.');
        }

        return ['password_reset' => true];
    }
}

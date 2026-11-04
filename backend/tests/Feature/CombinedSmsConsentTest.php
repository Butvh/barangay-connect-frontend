<?php

namespace Tests\Feature;

use App\Contracts\P2\Store;
use App\Models\CapacityGuard;
use App\Models\User;
use App\Providers\IntegrationServiceProvider;
use App\Services\Identity\CurrentSmsConsent;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\SmsDeliveryEligibility;
use App\Services\Identity\SmsEligibilityReferences;
use App\Support\ApiProblem;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Symfony\Component\Process\Process;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class CombinedSmsConsentTest extends TestCase
{
    use CombinedMysql;

    private CurrentSmsConsent $consent;

    private User $user;

    private EffectiveIdentity $observed;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        config(['integration.test_bindings' => true, 'integration.consent_test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
        $this->consent = app(CurrentSmsConsent::class);
        $this->user = $this->sourceUser('captain');
        $this->observed = EffectiveIdentity::fromUser($this->user);
    }

    private function input(string $state = 'granted', int $revision = 0, string $purpose = 'incident_review'): array
    {
        return ['state' => $state, 'expected_revision' => $revision, 'policy_version' => CurrentSmsConsent::POLICY,
            'template_version' => CurrentSmsConsent::TEMPLATES[$purpose]];
    }

    public function test_actual_authority_defaults_deny_and_self_mutation_records_exact_atomic_audit(): void
    {
        $this->assertSame($this->consent, app(SmsEligibilityReferences::class));
        $this->assertSame($this->consent, app(SmsDeliveryEligibility::class));
        $this->assertFalse($this->consent->allows($this->observed, 'incident_review'));
        $this->assertSame('not_granted', $this->consent->read($this->observed, 'incident_review')['state']);
        $this->assertSame(0, DB::table('notification_preferences')->where('user_id', $this->user->id)->count());
        $grant = $this->consent->change($this->observed, 'incident_review', $this->input());
        $this->assertSame(1, $grant['revision']);
        $this->assertTrue($this->consent->allows($this->observed, 'incident_review'));
        $this->assertFalse($this->consent->allows($this->observed, 'barangay_announcements'));
        $revoked = $this->consent->change($this->observed, 'incident_review', $this->input('revoked', 1));
        $this->assertSame(2, $revoked['revision']);
        $this->assertFalse($this->consent->allows($this->observed, 'incident_review'));
        $row = DB::table('notification_preferences')->where('user_id', $this->user->id)->first();
        $this->assertSame($this->user->id, $row->recorded_by);
        $this->assertNotNull($row->granted_at);
        $audit = DB::table('activity_logs')->where('actor_id', $this->user->id)->where('action', 'notification_preference.changed')->get();
        $this->assertCount(2, $audit);
        $reason = json_decode(json_decode($audit[1]->summary, true)['reason'], true);
        $this->assertSame('incident_review', $reason['purpose']);
        $this->assertSame('granted', $reason['from']);
        $this->assertArrayNotHasKey('phone', $reason);
    }

    public function test_current_worker_callback_runs_only_under_recipient_and_consent_guards(): void
    {
        $calls = 0;
        $callback = function ($revision, $policy, $template) use (&$calls): bool {
            $calls++;
            app(Store::class)->assertPersonLocked($this->user->id);
            $this->assertGreaterThan(0, DB::transactionLevel());
            $this->assertSame([1, 'sms-consent.v1', 'alert-review.v1'], [$revision, $policy, $template]);

            return true;
        };
        $this->assertFalse($this->consent->withCurrentEligibility($this->observed, 'incident_review', $callback));
        $this->assertSame(0, $calls);
        $this->consent->change($this->observed, 'incident_review', $this->input());
        $this->assertTrue($this->consent->withCurrentEligibility($this->observed, 'incident_review', $callback));
        $this->assertSame(1, $calls);
        $this->assertSame(0, DB::transactionLevel());
        $this->consent->change($this->observed, 'incident_review', $this->input('revoked', 1));
        $this->assertFalse($this->consent->withCurrentEligibility($this->observed, 'incident_review', $callback));
        $this->assertSame(1, $calls);
    }

    public function test_existing_repeatable_read_snapshot_is_rejected_and_new_current_gate_sees_revoke(): void
    {
        $this->consent->change($this->observed, 'incident_review', $this->input());
        config(['database.connections.consent_parallel' => config('database.connections.mysql')]);
        DB::beginTransaction();
        try {
            $query = fn () => DB::table('notification_preferences')->where('user_id', $this->user->id)->value('state');
            $this->assertSame('granted', $query());
            DB::connection('consent_parallel')->table('notification_preferences')->where('user_id', $this->user->id)
                ->update(['state' => 'revoked', 'revision' => 2, 'revoked_at' => now('UTC'), 'updated_at' => now('UTC')]);
            $this->assertSame('granted', $query());
            try {
                $this->consent->allows($this->observed, 'incident_review');
                $this->fail('Stale transaction snapshot was used as current authority.');
            } catch (\LogicException) {
                $this->addToAssertionCount(1);
            }
        } finally {
            DB::rollBack();
            DB::disconnect('consent_parallel');
        }
        $this->assertFalse($this->consent->allows($this->observed, 'incident_review'));
    }

    public function test_http_is_self_only_and_validates_versions_revisions_and_unknown_authority_fields(): void
    {
        $this->actingAs($this->user)->withSession($this->observed->sessionSnapshot());
        $url = '/api/v1/me/notification-preferences/incident_review';
        $this->getJson($url)->assertOk()->assertJsonPath('data.revision', 0)->assertJsonMissingPath('data.user_id');
        $this->putJson($url, $this->input() + ['user_id' => $this->user->id])->assertUnprocessable();
        $this->putJson($url, array_replace($this->input(), ['policy_version' => 'old-policy']))->assertUnprocessable();
        $this->putJson($url, $this->input())->assertOk()->assertJsonPath('data.state', 'granted');
        $this->putJson($url, $this->input('revoked', 0))->assertConflict();
        $other = $this->sourceUser('captain', $this->user->barangay_id);
        $this->actingAs($other)->withSession(EffectiveIdentity::fromUser($other)->sessionSnapshot());
        $this->getJson($url)->assertOk()->assertJsonPath('data.state', 'not_granted');
        $this->getJson('/api/v1/users/'.$this->user->id.'/notification-preferences/incident_review')->assertNotFound();
    }

    public function test_active_owner_can_revoke_after_losing_grant_role_and_old_observation_cannot_write(): void
    {
        $this->consent->change($this->observed, 'incident_review', $this->input());
        DB::table('users')->where('id', $this->user->id)->update(['is_captain' => false, 'auth_version' => 1]);
        $this->assertFalse($this->consent->allows($this->observed, 'incident_review'));
        $current = EffectiveIdentity::fromUser($this->user->fresh());
        $revoked = $this->consent->change($current, 'incident_review', $this->input('revoked', 1));
        $this->assertSame('revoked', $revoked['state']);
        try {
            $this->consent->change($current, 'incident_review', $this->input('granted', 2));
            $this->fail('Resident granted staff-only purpose.');
        } catch (ApiProblem $error) {
            $this->assertSame(403, $error->status);
        }
        $this->expectException(ApiProblem::class);
        $this->consent->change($this->observed, 'incident_review', $this->input('revoked', 2));
    }

    public function test_failure_after_actual_typed_audit_insert_rolls_back_preference_and_audit(): void
    {
        $before = DB::table('activity_logs')->where('actor_id', $this->user->id)->count();
        Event::listen(QueryExecuted::class, function (QueryExecuted $query): void {
            if (str_starts_with(strtolower($query->sql), 'insert into `activity_logs`')) {
                throw new \RuntimeException('injected after real typed audit insert');
            }
        });
        try {
            $this->consent->change($this->observed, 'incident_review', $this->input());
            $this->fail('Audit injection did not run.');
        } catch (\RuntimeException $error) {
            $this->assertSame('injected after real typed audit insert', $error->getMessage());
        } finally {
            Event::forget(QueryExecuted::class);
        }
        $this->assertSame(0, DB::table('notification_preferences')->where('user_id', $this->user->id)->count());
        $this->assertSame($before, DB::table('activity_logs')->where('actor_id', $this->user->id)->count());
    }

    public function test_unknown_purpose_inactive_identity_and_unavailable_authority_never_call_reservation(): void
    {
        $this->assertFalse($this->consent->allows($this->observed, 'unknown-purpose'));
        $foreign = EffectiveIdentity::fromUser($this->sourceUser('captain'));
        $this->consent->change($this->observed, 'incident_review', $this->input());
        $this->assertFalse($this->consent->allows($foreign, 'incident_review'));
        DB::table('users')->where('id', $this->user->id)->update(['account_status' => 'Inactive']);
        $called = false;
        $this->assertFalse($this->consent->withCurrentEligibility($this->observed, 'incident_review', function () use (&$called): bool {
            $called = true;

            return true;
        }));
        $this->assertFalse($called);
        config(['identity.enabled' => false]);
        try {
            $this->consent->allows($this->observed, 'incident_review');
            $this->fail('Missing authority did not report unavailable.');
        } catch (ApiProblem $error) {
            $this->assertSame(503, $error->status);
        }
    }

    private function worker(array $input): Process
    {
        $process = new Process([PHP_BINARY, base_path('tests/Support/consent-authority-worker.php')], base_path());
        $process->setInput(json_encode($input + ['user_id' => $this->user->id, 'observed' => $this->observed->sessionSnapshot()], JSON_THROW_ON_ERROR))->setTimeout(20)->start();
        $deadline = microtime(true) + 8;
        while (! str_contains($process->getOutput(), "ready\n") && $process->isRunning() && microtime(true) < $deadline) {
            usleep(20000);
        }
        $this->assertStringContainsString("ready\n", $process->getOutput(), $process->getErrorOutput());

        return $process;
    }

    private function outcome(Process $process): array
    {
        $process->wait();
        $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());
        $output = str_replace(["ready\n", "gate\n"], '', $process->getOutput());

        return json_decode($output, true, flags: JSON_THROW_ON_ERROR);
    }

    public function test_actual_concurrent_self_grants_preserve_one_revision_and_audit(): void
    {
        DB::beginTransaction();
        try {
            CapacityGuard::lockPeople([$this->user->id]);
            $first = $this->worker(['mode' => 'granted', 'revision' => 0]);
            $second = $this->worker(['mode' => 'granted', 'revision' => 0]);
            $this->assertTrue($first->isRunning() && $second->isRunning());
        } finally {
            DB::commit();
        }
        $results = [$this->outcome($first), $this->outcome($second)];
        $this->assertCount(1, array_filter($results, fn ($r) => $r['ok']));
        $this->assertCount(1, array_filter($results, fn ($r) => ! $r['ok'] && $r['code'] === 'CONFLICT'));
        $this->assertSame(1, $this->consent->read($this->observed, 'incident_review')['revision']);
        $this->assertSame(1, DB::table('activity_logs')->where('actor_id', $this->user->id)->count());
    }

    public function test_revocation_serializes_with_actual_current_gate_and_blocks_the_next_reservation(): void
    {
        $this->consent->change($this->observed, 'incident_review', $this->input());
        $gate = 'p1_consent_'.bin2hex(random_bytes(12));
        $this->assertSame(1, (int) DB::selectOne('SELECT GET_LOCK(?,0) AS held', [$gate])->held);
        try {
            $reservation = $this->worker(['mode' => 'reserve', 'gate' => $gate]);
            $deadline = microtime(true) + 8;
            while (! str_contains($reservation->getOutput(), "gate\n") && $reservation->isRunning() && microtime(true) < $deadline) {
                usleep(20000);
            }
            $this->assertStringContainsString("gate\n", $reservation->getOutput());
            $revoke = $this->worker(['mode' => 'revoked', 'revision' => 1]);
            $this->assertTrue($reservation->isRunning() && $revoke->isRunning());
        } finally {
            DB::selectOne('SELECT RELEASE_LOCK(?)', [$gate]);
        }
        $this->assertTrue($this->outcome($reservation)['result']);
        $this->assertSame('revoked', $this->outcome($revoke)['result']['state']);
        $called = false;
        $this->assertFalse($this->consent->withCurrentEligibility($this->observed, 'incident_review', function () use (&$called): bool {
            $called = true;

            return true;
        }));
        $this->assertFalse($called);
        $this->assertSame(0, DB::transactionLevel());
    }
}

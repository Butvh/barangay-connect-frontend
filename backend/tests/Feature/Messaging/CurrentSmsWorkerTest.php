<?php

namespace Tests\Feature\Messaging;

use App\Contracts\P2\ReferenceData;
use App\Models\SmsAuthorization;
use App\Models\SmsDelivery;
use App\Models\User;
use App\Providers\P2ServiceProvider;
use App\Services\Civic\CivicService;
use App\Services\Identity\CurrentSmsConsent;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\SmsDeliveryEligibility;
use App\Services\Messaging\MakeSmsCommandService;
use App\Services\Messaging\SmsDeliveryService;
use App\Services\Messaging\SmsReserved;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;

/** Actual P1 authority; transport fixtures do not establish positive P2 producer acceptance. */
class CurrentSmsWorkerTest extends MessagingTestCase
{
    protected bool $grantConsent = false;

    private function consent(string $purpose = 'incident_review', string $state = 'granted'): void
    {
        $service = app(CurrentSmsConsent::class);
        $actor = EffectiveIdentity::fromUser(User::findOrFail(1));
        $row = $service->read($actor, $purpose);
        $service->change($actor, $purpose, ['state' => $state, 'expected_revision' => $row['revision'],
            'policy_version' => CurrentSmsConsent::POLICY, 'template_version' => CurrentSmsConsent::TEMPLATES[$purpose]]);
    }

    private function fakeAccepted(): void
    {
        Http::fake(function () {
            $this->assertSame(0, DB::transactionLevel());
            $this->assertSame(2, DB::table('sms_authorizations')->count());

            return Http::response([['message_id' => 901, 'recipient' => '639171234567', 'status' => 'Queued']]);
        });
    }

    private function assertDenied(SmsDelivery $d, string $reason, int $attempts = 0): void
    {
        $this->assertSame('blocked', $d->fresh()->state);
        $this->assertSame($reason, $d->fresh()->last_error);
        $this->assertSame($attempts, DB::table('sms_attempts')->count());
        $this->assertSame(1, DB::table('delivery_receipts')->where(['channel' => 'in_app', 'state' => 'complete'])->count());
        Http::assertNothingSent();
    }

    public function test_missing_and_revoked_preferences_do_not_reserve(): void
    {
        $d = $this->prepare();
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertDenied($d, 'consent_denied');
        $this->assertSame(0, DB::table('sms_authorizations')->count());
        $this->assertSame(0, DB::table('messaging_budgets')->count());
        $this->consent();
        $this->consent(state: 'revoked');
        $d->fresh()->forceFill(['state' => 'pending'])->save();
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertDenied($d, 'consent_denied');
    }

    public function test_missing_binding_is_unavailable_not_a_true_fallback(): void
    {
        $this->consent();
        $d = $this->prepare();
        app()->forgetInstance(SmsDeliveryEligibility::class);
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertDenied($d, 'consent_authority_unavailable');
    }

    public function test_mixed_timezone_connection_is_unavailable_before_reservation(): void
    {
        $this->consent();
        $d = $this->prepare();
        DB::statement("SET time_zone='+08:00'");
        try {
            app(SmsDeliveryService::class)->send($d->id);
            $this->assertDenied($d, 'consent_connection_not_utc');
            $this->assertSame(0, DB::table('sms_authorizations')->count());
        } finally {
            DB::statement("SET time_zone='+00:00'");
        }
    }

    public function test_both_private_gates_use_actual_authority_in_the_required_lock_order(): void
    {
        $this->consent();
        $d = $this->prepare();
        $trace = [];
        DB::listen(function ($event) use (&$trace) {
            if (str_contains(strtolower($event->sql), 'for update')) {
                foreach (['users', 'notification_preferences', 'emergency_alerts', 'sms_deliveries'] as $table) {
                    if (str_contains($event->sql, chr(96).$table.chr(96))) {
                        $trace[] = $table;
                    }
                }
            }
        });
        $this->fakeAccepted();
        app(SmsDeliveryService::class)->send($d->id);
        app(SmsDeliveryService::class)->send($d->id);
        Http::assertSentCount(1);
        $this->assertSame('accepted', $d->fresh()->state);
        $proofs = SmsAuthorization::orderBy('id')->get();
        $this->assertSame(['reservation', 'pre_send'], $proofs->pluck('gate')->all());
        $this->assertSame([1, 1], $proofs->pluck('consent_revision')->all());
        $this->assertSame([], $proofs[0]->toArray());
        $this->assertTrue($proofs[0]->isGuarded('consent_revision'));
        $this->assertLessThan(array_search('notification_preferences', $trace), array_search('users', $trace));
        $this->assertLessThan(array_search('emergency_alerts', $trace), array_search('notification_preferences', $trace));
        $this->assertLessThan(array_search('sms_deliveries', $trace), array_search('emergency_alerts', $trace));
    }

    public function test_other_purpose_and_unavailable_source_do_not_reserve(): void
    {
        $this->consent('barangay_announcements');
        $d = $this->prepare();
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertDenied($d, 'consent_denied');
        $this->consent();
        $d->fresh()->forceFill(['state' => 'pending'])->save();
        DB::table('outbox_events')->where('id', $d->receipt->event->id)->update(['resource_id' => 999999]);
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertDenied($d, 'source_unavailable');
    }

    public function test_obsolete_persisted_version_is_denied_by_actual_authority(): void
    {
        $this->consent();
        $d = $this->prepare();
        // Disposable fault injection emulates retained obsolete data, never a fake authority.
        DB::statement('ALTER TABLE notification_preferences ALTER CHECK preference_version_check NOT ENFORCED');
        try {
            DB::table('notification_preferences')->where('purpose', 'incident_review')->update([
                'revision' => 2, 'policy_version' => 'sms-consent.obsolete', 'granted_at' => now('UTC'), 'updated_at' => now('UTC')]);
            app(SmsDeliveryService::class)->send($d->id);
            $this->assertDenied($d, 'consent_denied');
        } finally {
            DB::table('notification_preferences')->where('purpose', 'incident_review')->update([
                'revision' => 3, 'policy_version' => 'sms-consent.v1', 'granted_at' => now('UTC'), 'updated_at' => now('UTC')]);
            DB::statement('ALTER TABLE notification_preferences ALTER CHECK preference_version_check ENFORCED');
        }
    }

    public function test_real_revocation_between_reservation_and_final_gate_blocks_post(): void
    {
        $this->consent();
        $d = $this->prepare();
        Event::listen(SmsReserved::class, function () {
            $this->assertSame(0, DB::transactionLevel());
            $this->consent(state: 'revoked');
        });
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertDenied($d, 'consent_denied', 1);
        $this->assertSame(['reservation'], DB::table('sms_authorizations')->pluck('gate')->all());
        $this->assertSame('rejected', DB::table('sms_attempts')->value('outcome'));
    }

    #[DataProvider('postReservationChanges')]
    public function test_account_generation_role_contact_and_event_are_rechecked(string $change, string $reason): void
    {
        $this->consent();
        $d = $this->prepare();
        Event::listen(SmsReserved::class, function () use ($change, $d) {
            match ($change) {
                'inactive' => DB::table('users')->where('id', 1)->update(['account_status' => 'Inactive']),
                'generation' => DB::table('users')->where('id', 1)->increment('auth_version'),
                'role' => DB::table('users')->where('id', 1)->update(['is_captain' => false, 'is_resident' => true]),
                'contact' => DB::table('users')->where('id', 1)->update(['contact_number' => '09179999999']),
                'event' => DB::table('outbox_events')->where('id', $d->receipt->event->id)->update(['resource_id' => 2]),
            };
        });
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertDenied($d, $reason, 1);
        $this->assertSame(1, DB::table('sms_authorizations')->count());
    }

    public static function postReservationChanges(): array
    {
        return [['inactive', 'consent_denied'], ['generation', 'consent_denied'], ['role', 'consent_denied'],
            ['contact', 'destination_changed'], ['event', 'event_reference_changed']];
    }

    public function test_revoke_before_definite_retry_does_not_make_another_post(): void
    {
        $this->consent();
        $d = $this->prepare();
        Http::fake(['*' => Http::response([], 429, ['Retry-After' => '1'])]);
        app(SmsDeliveryService::class)->send($d->id);
        $this->consent(state: 'revoked');
        $d->fresh()->forceFill(['next_attempt_at' => now()->subMinute()])->save();
        app(SmsDeliveryService::class)->send($d->id);
        Http::assertSentCount(1);
        $this->assertSame('consent_denied', $d->fresh()->last_error);
        $this->assertSame(1, DB::table('sms_attempts')->count());
    }

    public function test_legacy_family_cannot_obtain_new_sms_authority(): void
    {
        $this->consent();
        $d = $this->prepare('alert.created.v1');
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertDenied($d, 'sms_producer_family_denied');
    }

    public function test_existing_transaction_is_rejected_before_current_reads(): void
    {
        $d = $this->prepare();
        DB::beginTransaction();
        try {
            $this->expectException(\LogicException::class);
            app(SmsDeliveryService::class)->send($d->id);
        } finally {
            DB::rollBack();
        }
    }

    public function test_reservation_sql_failure_rolls_back_attempt_budget_and_evidence(): void
    {
        $this->consent();
        $d = $this->prepare();
        $connection = DB::connection();
        $original = $connection->getEventDispatcher();
        $events = clone $original;
        $connection->setEventDispatcher($events);
        $events->listen(QueryExecuted::class, function ($event) {
            if (str_starts_with(strtolower($event->sql), 'insert into '.chr(96).'sms_authorizations'.chr(96))) {
                throw new \RuntimeException('fixture_reservation_failure');
            }
        });
        try {
            try {
                app(SmsDeliveryService::class)->send($d->id);
                $this->fail('Reservation failure must interrupt.');
            } catch (\RuntimeException $e) {
                $this->assertSame('fixture_reservation_failure', $e->getMessage());
            }
        } finally {
            $connection->setEventDispatcher($original);
        }
        $this->assertSame('pending', $d->fresh()->state);
        foreach (['sms_attempts', 'sms_authorizations', 'messaging_budgets'] as $table) {
            $this->assertSame(0, DB::table($table)->count());
        }
        Http::assertNothingSent();
    }

    public function test_crash_after_reservation_is_uncertain_and_never_blindly_retried(): void
    {
        $this->consent();
        $d = $this->prepare();
        Event::listen(SmsReserved::class, fn () => throw new \RuntimeException('fixture_worker_crash'));
        try {
            app(SmsDeliveryService::class)->send($d->id);
            $this->fail('Crash must interrupt before POST.');
        } catch (\RuntimeException $e) {
            $this->assertSame('fixture_worker_crash', $e->getMessage());
        }
        $d->fresh()->forceFill(['lease_until' => now()->subMinute()])->save();
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertSame('uncertain', $d->fresh()->state);
        $this->assertSame(1, DB::table('sms_authorizations')->count());
        Http::assertNothingSent();
    }

    public function test_evidence_is_private_immutable_and_retained(): void
    {
        $this->consent();
        $d = $this->prepare();
        $this->fakeAccepted();
        app(SmsDeliveryService::class)->send($d->id);
        $proof = SmsAuthorization::firstOrFail();
        try {
            DB::table('sms_authorizations')->where('id', $proof->id)->update(['consent_revision' => 2]);
            $this->fail('SQL evidence mutation must fail.');
        } catch (QueryException $e) {
            $this->assertSame('45000', $e->errorInfo[0]);
        }
        $migration = require __DIR__.'/../../../database/migrations/2026_11_04_000300_create_sms_authorization_evidence.php';
        try {
            $migration->down();
            $this->fail('Retained evidence must block downgrade.');
        } catch (\LogicException $e) {
            $this->assertSame('sms_authorizations_retained', $e->getMessage());
        }
        $row = (array) DB::table('sms_authorizations')->first();
        unset($row['id']);
        $row['claim_token'] = (string) Str::uuid();
        $row['consent_revision'] = 0;
        $this->expectException(QueryException::class);
        DB::table('sms_authorizations')->insert($row);
    }

    public function test_actual_source_retraction_between_gates_blocks_announcement_post(): void
    {
        $this->consent('barangay_announcements');
        $d = $this->prepare('announcement.published.v2');
        $event = $d->receipt->event;
        config(['messaging.make.enabled' => true, 'messaging.make.barangay_id' => 1]);
        app(MakeSmsCommandService::class)->accept(['event_id' => $event->event_id,
            'barangay_id' => 1, 'type' => $event->type, 'template_key' => $event->template_key]);
        Event::listen(SmsReserved::class, function () {
            $app = app();
            require __DIR__.'/../../P2/bindings.php';
            app()->register(P2ServiceProvider::class);
            $actor = app(ReferenceData::class)->actorFor(1);
            app(CivicService::class)->retract($actor, 1, ['expected_revision' => 0, 'reason' => 'Fictional withdrawal']);
        });
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertDenied($d, 'source_unavailable', 1);
        $this->assertSame('Retracted', DB::table('announcements')->where('id', 1)->value('status'));
        $this->assertSame('granted', DB::table('notification_preferences')->where('purpose', 'barangay_announcements')->value('state'));
    }

    public function test_actual_revocation_and_worker_use_independent_processes_and_ordered_current_locks(): void
    {
        $this->consent();
        $d = $this->prepare();
        $barrier = sys_get_temp_dir().'/bc-current-sms-'.bin2hex(random_bytes(8));
        mkdir($barrier);
        $workers = [];
        try {
            $revoke = new Process([PHP_BINARY, __DIR__.'/../../Support/current-sms-worker.php', 'revoke', $barrier, (string) $d->id]);
            $revoke->setTimeout(25)->start();
            $workers[] = $revoke;
            $deadline = microtime(true) + 10;
            while (! is_file($barrier.'/revoke-held') && $revoke->isRunning() && microtime(true) < $deadline) {
                usleep(10000);
            }
            $this->assertFileExists($barrier.'/revoke-held', $revoke->getErrorOutput().$revoke->getOutput());
            $before = (int) DB::selectOne("SHOW GLOBAL STATUS LIKE 'Innodb_row_lock_waits'")->Value;
            $send = new Process([PHP_BINARY, __DIR__.'/../../Support/current-sms-worker.php', 'send', $barrier, (string) $d->id]);
            $send->setTimeout(25)->start();
            $workers[] = $send;
            $deadline = microtime(true) + 8;
            do {
                usleep(10000);
                $after = (int) DB::selectOne("SHOW GLOBAL STATUS LIKE 'Innodb_row_lock_waits'")->Value;
            } while ($after <= $before && microtime(true) < $deadline);
            $this->assertGreaterThan($before, $after, 'Actual worker must wait for the revocation guard.');
            $this->assertSame(0, DB::table('sms_attempts')->count());
            touch($barrier.'/release');
            foreach ($workers as $worker) {
                $worker->wait();
                $this->assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
            }
            $this->assertSame(['state' => 'revoked', 'revision' => 2, 'provider_calls' => 0], json_decode($revoke->getOutput(), true));
            $this->assertSame(['state' => 'blocked', 'error' => 'consent_denied', 'provider_calls' => 0], json_decode($send->getOutput(), true));
            $this->assertSame(0, DB::table('sms_authorizations')->count());
            $this->assertSame(0, DB::table('messaging_budgets')->count());
        } finally {
            touch($barrier.'/release');
            foreach ($workers as $worker) {
                if ($worker->isRunning()) {
                    $worker->stop();
                }
            }
            foreach (glob($barrier.'/*') as $file) {
                unlink($file);
            }
            rmdir($barrier);
        }
    }

    public function test_empty_evidence_downgrade_and_partial_table_failure_are_recoverable(): void
    {
        $migration = require __DIR__.'/../../../database/migrations/2026_11_04_000300_create_sms_authorization_evidence.php';
        $migration->down();
        $connection = DB::connection();
        $original = $connection->getEventDispatcher();
        $events = clone $original;
        $connection->setEventDispatcher($events);
        $events->listen(QueryExecuted::class, function ($event) {
            if (str_starts_with($event->sql, 'CREATE TABLE sms_authorizations')) {
                throw new \RuntimeException('fixture_sms_evidence_ddl_failure');
            }
        });
        try {
            try {
                $migration->up();
                $this->fail('Injected DDL interruption must fire.');
            } catch (\RuntimeException $e) {
                $this->assertSame('fixture_sms_evidence_ddl_failure', $e->getMessage());
            }
        } finally {
            $connection->setEventDispatcher($original);
        }
        $migration->up();
        $migration->up();
        $this->assertSame(0, DB::table('sms_authorizations')->count());
        $this->assertSame(0, DB::table('sms_attempts')->count());
    }
}

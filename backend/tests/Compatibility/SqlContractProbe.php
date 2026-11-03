<?php

namespace Tests\Compatibility;

use App\Contracts\Events\AuditSummary;
use App\Contracts\Events\EventContext;
use App\Contracts\Events\EventId;
use App\Contracts\Events\OutboxWriter;
use App\Contracts\Events\RecipientReference;
use App\Models\OutboxEvent;
use App\Services\Messaging\EventContract;
use App\Services\Messaging\InAppNotificationHandler;
use App\Services\Messaging\OutboxDispatcher;
use Illuminate\Contracts\Container\Container;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

/** Test infrastructure only. Uses real selected adapters; never implements a production writer or handler. */
final class SqlContractProbe
{
    private array $fixture = [];

    private array $eventIds = [];

    private string $peerName;

    private array $checks = [];

    public function __construct(private Container $app) {}

    public function assertDisposable(): void
    {
        $name = $this->app['config']->get('integration.connection', 'mysql');
        $connection = DB::connection($name);
        $this->ensure($name === DB::getDefaultConnection() && $connection->getDriverName() === 'mysql', 'connection_contract_mismatch');
        $this->ensure($this->app->environment('testing') && getenv('DB_TEST_DISPOSABLE') === '1'
            && str_starts_with($connection->getDatabaseName(), 'bc_dba_') && $connection->getDatabaseName() === getenv('DB_TEST_DATABASE'), 'disposable_database_required');
        $this->ensure($connection->transactionLevel() === 0, 'probe_requires_committed_connection');
        $version = $connection->selectOne('SELECT VERSION() AS v')->v;
        $this->ensure(str_starts_with($version, '8.4.') && ! str_contains($version, 'MariaDB'), 'mysql_84_required');
        $tables = $connection->select("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('outbox_events','outbox_recipients','delivery_receipts','notifications','users')");
        $this->ensure(count($tables) === 5 && ! array_filter($tables, fn ($row) => $row->ENGINE !== 'InnoDB'), 'migrated_innodb_schema_required');
    }

    public function run(OutboxWriter $writer, InAppNotificationHandler $handler, bool $smsIntent = false): array
    {
        $this->assertDisposable();
        $this->fixture = [];
        $this->eventIds = [];
        $this->checks = [];
        $connection = DB::connection();
        $this->peerName = 'dba_probe_peer_'.bin2hex(random_bytes(5));
        $this->app['config']->set('database.connections.'.$this->peerName, $connection->getConfig());
        $priorHttp = Http::getFacadeRoot();
        $priorQueue = Queue::getFacadeRoot();
        $wasBound = $this->app->bound(InAppNotificationHandler::class);
        $priorHandler = $wasBound ? $this->app->make(InAppNotificationHandler::class) : null;
        $calls = 0;
        $http = new Factory;
        $http->fake(function () use (&$calls) {
            $calls++;
            throw new ContractCheckFailure('provider_io_forbidden');
        });
        Http::swap($http);
        $queue = Queue::fake();
        $this->app->instance(InAppNotificationHandler::class, $handler);
        try {
            $this->createFixture();
            $rolledBack = $this->newId();
            $connection->beginTransaction();
            try {
                $this->write($writer, $rolledBack);
                $this->assertCallerTransaction($rolledBack);
            } finally {
                $this->rollbackOpenTransaction();
            }
            $this->ensure(! DB::table('outbox_events')->where('event_id', $rolledBack->value)->exists(), 'writer_rollback_left_event');
            $this->checks[] = 'caller_transaction_and_rollback';

            $committed = $this->commitEvent($writer);
            DB::table('emergency_alerts')->where('id', $this->fixture['alert'])->update(['status' => 'Resolved']);
            $this->dispatchAndAssert($committed, 'complete');
            $this->checks[] = 'in_app_sql_dispatch_and_event_time';
            DB::table('outbox_events')->where('event_id', $committed->value)->update(['dispatched_at' => null]);
            $this->dispatchAndAssert($committed, 'complete');
            $this->ensure(DB::table('notifications')->where('event_id', $committed->value)->count() === 1, 'replay_duplicated_notification');
            $this->checks[] = 'independent_receipt_replay';

            $revoked = $this->commitEvent($writer);
            DB::table('users')->where('id', $this->fixture['recipient'])->update(['account_status' => 'Inactive']);
            $this->dispatchAndAssert($revoked, 'failed');
            DB::table('users')->where('id', $this->fixture['recipient'])->update(['account_status' => 'Active']);
            $this->checks[] = 'recipient_source_revocation';

            $foreign = $this->newId();
            $connection->beginTransaction();
            $rejected = false;
            try {
                $this->write($writer, $foreign, false, $this->fixture['foreign_recipient']);
            } catch (\Throwable) {
                $rejected = true;
            }
            $this->ensure($connection->transactionLevel() === 1, 'writer_committed_independently');
            $this->rollbackOpenTransaction();
            $this->ensure($rejected && ! DB::table('outbox_events')->where('event_id', $foreign->value)->exists(), 'cross_scope_recipient_accepted');
            $this->checks[] = 'cross_scope_recipient_rejected';

            foreach (['unknown_type', 'wrong_version', 'unknown_template', 'private_context', 'oversize_context', 'unauthorized_sms'] as $case) {
                $id = $this->commitEvent($writer);
                $patch = match ($case) {
                    'unknown_type' => ['type' => 'unregistered.probe.v2'],
                    'wrong_version' => ['version' => 1],
                    'unknown_template' => ['template_key' => 'unregistered-template'],
                    'private_context' => ['payload' => json_encode(['status' => 'Pending', 'reset_authorization' => 'fictional-only'])],
                    'oversize_context' => ['payload' => json_encode(['status' => 'Pending', 'extra' => str_repeat('x', 300)])],
                    'unauthorized_sms' => ['type' => 'incident.status_changed.v2', 'template_key' => 'incident-status-changed.v2'],
                };
                DB::table('outbox_events')->where('event_id', $id->value)->update($patch);
                if ($case === 'unauthorized_sms') {
                    DB::table('outbox_recipients')->where('outbox_event_id', $this->event($id)->id)->update(['sms' => true]);
                }
                app(OutboxDispatcher::class)->dispatchOne($id->value);
                $this->ensure($this->event($id)->blocked_at !== null && ! DB::table('delivery_receipts')->where('outbox_event_id', $this->event($id)->id)->exists(), 'unsupported_contract_created_receipts');
            }
            $this->checks[] = 'unknown_version_context_channel_template_fail_closed';
            foreach ([fn () => new EventId(str_repeat('a', 32)), fn () => new EventContext('arbitrary-message'), fn () => new AuditSummary(['reason' => str_repeat('界', 1000)])] as $invalid) {
                $rejected = false;
                try {
                    $invalid();
                } catch (\InvalidArgumentException) {
                    $rejected = true;
                }
                $this->ensure($rejected, 'typed_invalid_fixture_accepted');
            }
            $this->checks[] = 'typed_uuid_context_and_audit_size_rejected';

            if ($smsIntent) {
                $sms = $this->commitEvent($writer, true);
                $this->dispatchAndAssert($sms, 'complete');
                $row = DB::table('delivery_receipts')->where('outbox_event_id', $this->event($sms)->id)->where('channel', 'sms')->first();
                $this->ensure($row && $row->template_key === 'alert-review.v1' && $row->state === 'pending', 'authorized_sms_intent_not_independent');
                $this->ensure(DB::table('sms_deliveries')->where('receipt_id', $row->id)->value('state') === 'pending', 'sms_intent_delivery_missing');
                $this->checks[] = 'separate_authorized_sms_intent';
            } else {
                $this->checks[] = 'sms_intent_not_requested';
            }
            $this->ensure($calls === 0 && $queue->pushedJobs() === [], 'writer_or_handler_external_side_effect');
            $this->ensure(DB::table('sms_attempts')->whereIn('sms_delivery_id', $this->deliveryIds())->count() === 0, 'provider_attempt_not_authorized');

            return ['checks' => $this->checks, 'connection' => $connection->getName(), 'provider_calls' => 0, 'sms_intent' => $smsIntent];
        } finally {
            $this->rollbackOpenTransaction();
            try {
                $this->cleanup();
            } finally {
                DB::purge($this->peerName);
                Http::swap($priorHttp);
                Queue::swap($priorQueue);
                if ($wasBound) {
                    $this->app->instance(InAppNotificationHandler::class, $priorHandler);
                } else {
                    $this->app->offsetUnset(InAppNotificationHandler::class);
                }
            }
        }
    }

    private function write(OutboxWriter $writer, EventId $id, bool $sms = false, ?int $recipient = null): void
    {
        $writer->record($id, 'incident.created.v2', $this->fixture['scope'], $this->fixture['alert'],
            [new RecipientReference($recipient ?? $this->fixture['recipient'], true, $sms)],
            new \DateTimeImmutable('2026-11-03T08:12:34.123456+08:00'), new EventContext('Pending'));
    }

    private function assertCallerTransaction(EventId $id): void
    {
        $this->ensure(DB::transactionLevel() === 1, 'writer_committed_independently');
        $event = $this->event($id);
        EventContract::definition($event);
        $this->ensure($event->version === 2 && $event->type === 'incident.created.v2' && $event->payload === ['status' => 'Pending'], 'canonical_fixture_mismatch');
        $this->ensure($event->occurred_at->format('Y-m-d\TH:i:s.u\Z') === '2026-11-03T00:12:34.123456Z', 'utc_event_time_not_preserved');
        $recipients = $event->recipients;
        $this->ensure($recipients->count() === 1 && $recipients->first()->audience === 'official', 'relational_recipient_fixture_mismatch');
        EventContract::recipient($event, $recipients->first(), EventContract::definition($event));
        $this->ensure(! DB::connection($this->peerName)->table('outbox_events')->where('event_id', $id->value)->exists(), 'writer_committed_independently');
    }

    private function commitEvent(OutboxWriter $writer, bool $sms = false): EventId
    {
        $id = $this->newId();
        DB::beginTransaction();
        try {
            $this->write($writer, $id, $sms);
            $this->assertCallerTransaction($id);
            DB::commit();
        } catch (\Throwable $e) {
            $this->rollbackOpenTransaction();
            throw $e;
        }

        return $id;
    }

    private function dispatchAndAssert(EventId $id, string $expected): void
    {
        $this->ensure(app(OutboxDispatcher::class)->dispatchOne($id->value), 'committed_event_not_dispatched');
        $event = $this->event($id);
        $receipt = DB::table('delivery_receipts')->where('outbox_event_id', $event->id)->where('channel', 'in_app')->first();
        $this->ensure($receipt && $receipt->state === $expected, 'handler_receipt_not_'.$expected);
        if ($expected === 'failed') {
            $this->ensure($receipt->diagnostic_code === 'in_app_recipient_unavailable' && ! DB::table('notifications')->where('event_id', $id->value)->exists(), 'revoked_recipient_false_success');

            return;
        }
        $n = DB::table('notifications')->where('event_id', $id->value)->first();
        $this->ensure($n && $n->event_status === 'Pending' && $n->target === 'official-alert.html?id='.$this->fixture['alert'], 'event_time_or_target_mismatch');
        $this->ensure($receipt->template_key === 'incident-created.in-app.v2', 'channel_template_mismatch');
    }

    private function newId(): EventId
    {
        $id = EventId::generate();
        $this->eventIds[] = $id->value;

        return $id;
    }

    private function event(EventId $id): OutboxEvent
    {
        return OutboxEvent::where('event_id', $id->value)->first() ?? throw new ContractCheckFailure('writer_did_not_persist_fixture');
    }

    private function ensure(bool $condition, string $code): void
    {
        if (! $condition) {
            throw new ContractCheckFailure($code);
        }
    }

    private function rollbackOpenTransaction(): void
    {
        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }
    }

    private function createFixture(): void
    {
        DB::transaction(function () {
            $scope = DB::table('barangays')->insertGetId(['name' => 'Fictional contract probe']);
            $foreignScope = DB::table('barangays')->insertGetId(['name' => 'Fictional foreign contract probe']);
            $home = DB::table('households')->insertGetId(['barangay_id' => $scope, 'address' => 'Fictional probe district']);
            $user = fn ($area, $captain) => DB::table('users')->insertGetId(['barangay_id' => $area, 'household_id' => $captain ? null : $home, 'full_name' => 'Fictional contract identity',
                'email' => bin2hex(random_bytes(12)).'@example.invalid', 'password' => password_hash(bin2hex(random_bytes(24)), PASSWORD_BCRYPT, ['cost' => 4]),
                'account_status' => 'Active', 'is_captain' => $captain, 'is_resident' => ! $captain]);
            $resident = $user($scope, false);
            $recipient = $user($scope, true);
            $foreignRecipient = $user($foreignScope, true);
            $alert = DB::table('emergency_alerts')->insertGetId(['barangay_id' => $scope, 'resident_id' => $resident, 'household_id' => $home, 'alert_type' => 'Other', 'location_label' => 'Fictional probe district', 'status' => 'Pending', 'reported_at' => '2026-11-03 00:12:34.123456']);
            $this->fixture = ['scope' => $scope, 'foreign_scope' => $foreignScope, 'home' => $home, 'resident' => $resident, 'recipient' => $recipient, 'foreign_recipient' => $foreignRecipient, 'alert' => $alert];
        });
    }

    private function deliveryIds(): array
    {
        $events = DB::table('outbox_events')->whereIn('event_id', $this->eventIds)->pluck('id');
        $receipts = DB::table('delivery_receipts')->whereIn('outbox_event_id', $events)->pluck('id');

        return DB::table('sms_deliveries')->whereIn('receipt_id', $receipts)->pluck('id')->all();
    }

    private function cleanup(): void
    {
        $events = DB::table('outbox_events')->whereIn('event_id', $this->eventIds)->pluck('id');
        $deliveries = $this->deliveryIds();
        DB::table('sms_attempts')->whereIn('sms_delivery_id', $deliveries)->delete();
        DB::table('sms_deliveries')->whereIn('id', $deliveries)->delete();
        DB::table('notifications')->whereIn('event_id', $this->eventIds)->delete();
        foreach (['make_commands', 'make_dispatches', 'delivery_receipts', 'outbox_recipients'] as $table) {
            DB::table($table)->whereIn('outbox_event_id', $events)->delete();
        }
        DB::table('outbox_events')->whereIn('id', $events)->delete();
        if ($this->fixture) {
            DB::table('emergency_alerts')->where('id', $this->fixture['alert'])->delete();
            DB::table('users')->whereIn('id', [$this->fixture['resident'], $this->fixture['recipient'], $this->fixture['foreign_recipient']])->delete();
            DB::table('households')->where('id', $this->fixture['home'])->delete();
            DB::table('barangays')->whereIn('id', [$this->fixture['scope'], $this->fixture['foreign_scope']])->delete();
        }
    }
}

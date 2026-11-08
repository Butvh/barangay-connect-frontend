<?php

namespace Tests\Feature\Messaging;

use App\Models\Barangay;
use App\Models\OutboxEvent;
use App\Models\PersonnelAppointment;
use App\Models\SmsDelivery;
use App\Models\User;
use App\Providers\P2ServiceProvider;
use App\Services\Civic\CivicService;
use App\Services\Identity\CurrentSmsConsent;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\SmsDeliveryEligibility;
use App\Services\Messaging\MakeSmsCommandService;
use App\Services\Messaging\OutboxDispatcher;
use App\Services\Messaging\SmsDeliveryService;
use App\Services\Messaging\SmsReserved;
use App\Services\P2\Persistence\ReferenceData;
use App\Services\P2\Persistence\RelationalStore;
use App\Services\P2\Persistence\TypedAuditRecorder;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;
use Tests\MysqlDbaTestCase;

/** Negative/retry tests consume actual unchanged P2 producer-fixture events in a child process. */
class ProducedEventWorkerTest extends MysqlDbaTestCase
{
    private array $fixture;

    private CurrentSmsConsent $consent;

    private string $responseMode = 'accepted';

    private ?int $publicationRevision = null;

    protected function setUp(): void
    {
        parent::setUp();
        $process = new Process([PHP_BINARY, __DIR__.'/../../Support/produced-source.php', 'positive']);
        $process->setTimeout(30)->run();
        $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());
        $this->fixture = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame(getenv('DB_TEST_DATABASE'), $this->fixture['database']);
        $app = app();
        require __DIR__.'/../../P2/bindings.php';
        $app->register(P2ServiceProvider::class);
        config(['identity.enabled' => true, 'integration.connection' => 'mysql', 'messaging.make.enabled' => false]);
        $this->consent = new CurrentSmsConsent(new RelationalStore, new IdentityReferences, new TypedAuditRecorder);
        $app->instance(SmsDeliveryEligibility::class, $this->consent);
        config(['messaging.sms.destination_pepper' => str_repeat('p', 32), 'messaging.sms.daily_segment_budget' => 10,
            'messaging.sms.allowlist' => ['639171234567', '639181234567'], 'messaging.make.barangay_id' => $this->fixture['scope'], 'messaging.make.credential_id' => 'produced-test-v1']);
        Http::fake(function () {
            $this->assertSame(0, DB::transactionLevel());
            if ($this->responseMode === 'rate_limited') {
                return Http::response('rate limit', 429, ['Retry-After' => '1']);
            }
            if ($this->responseMode === 'uncertain') {
                throw new ConnectionException('Fictional ambiguous transport');
            }

            return Http::response([['message_id' => 81001, 'recipient' => '639171234567', 'status' => 'Queued']]);
        });
    }

    private function enqueue(bool $publication = false): SmsDelivery
    {
        $event = OutboxEvent::where('event_id', $this->fixture['events'][$publication ? 1 : 0]['event_id'])->sole();
        app(OutboxDispatcher::class)->dispatchOne($event->event_id);
        $this->assertSame($publication ? 2 : 1, DB::table('delivery_receipts')->where('outbox_event_id', $event->id)->where('channel', 'in_app')->where('state', 'complete')->count());
        if ($publication) {
            $this->publicationRevision = (int) DB::table('announcements')->where('id', $event->resource_id)->value('revision');
            config(['messaging.make.enabled' => true]);
            $command = ['event_id' => $event->event_id, 'barangay_id' => $event->barangay_id, 'type' => $event->type, 'template_key' => $event->template_key];
            $this->assertTrue(app(MakeSmsCommandService::class)->accept($command));
        }

        return SmsDelivery::whereHas('receipt', fn ($q) => $q->where('outbox_event_id', $event->id))->sole();
    }

    private function revoke(User $user, string $purpose): void
    {
        $identity = EffectiveIdentity::fromUser($user->fresh());
        $state = $this->consent->read($identity, $purpose);
        $this->consent->change($identity, $purpose, ['state' => 'revoked', 'expected_revision' => $state['revision'],
            'policy_version' => CurrentSmsConsent::POLICY, 'template_version' => CurrentSmsConsent::TEMPLATES[$purpose]]);
    }

    public static function currentChanges(): array
    {
        $cases = [];
        foreach (['consent', 'account', 'role', 'scope', 'contact', 'source'] as $change) {
            foreach ([false, true] as $afterReservation) {
                $cases[$change.($afterReservation ? ' after reservation' : ' before reservation')] = [$change, $afterReservation];
            }
        }
        $cases['generation after original capture'] = ['generation', true];
        $cases['appointment after original capture'] = ['appointment', true];
        $cases['Make credential after reservation'] = ['make_credential', true];
        $cases['Make scope after reservation'] = ['make_scope', true];

        return $cases;
    }

    #[DataProvider('currentChanges')]
    public function test_actual_source_current_changes_deny_without_repeating_in_app(string $change, bool $afterReservation): void
    {
        $publication = in_array($change, ['source', 'make_credential', 'make_scope'], true);
        $delivery = $this->enqueue($publication);
        $recipient = $delivery->receipt->recipient;
        if ($change === 'appointment') {
            DB::table('users')->where('id', $recipient->id)->update(['is_captain' => false]);
            PersonnelAppointment::forceCreate(['user_id' => $recipient->id, 'barangay_id' => $recipient->barangay_id, 'role' => 'secretary', 'status' => 'Active', 'source' => 'external']);
        }
        $mutate = function () use ($change, $afterReservation, $recipient, $publication, $delivery): void {
            match ($change) {
                'consent' => $this->revoke($recipient, $publication ? 'barangay_announcements' : 'incident_review'),
                'account' => DB::table('users')->where('id', $recipient->id)->update(['account_status' => 'Inactive']),
                'generation' => DB::table('users')->where('id', $recipient->id)->increment('auth_version'),
                'role' => DB::table('users')->where('id', $recipient->id)->update(['is_captain' => false]),
                'appointment' => DB::table('personnel_appointments')->where('user_id', $recipient->id)->update(['status' => 'Inactive']),
                'contact' => DB::table('users')->where('id', $recipient->id)->update(['contact_number' => $afterReservation ? '09181234567' : null]),
                'scope' => $this->injectScopeChange($recipient),
                'source' => $this->retract($delivery->receipt->event),
                'make_credential' => config(['messaging.make.credential_id' => 'rotated-test-v2']),
                'make_scope' => config(['messaging.make.barangay_id' => $recipient->barangay_id + 1000]),
            };
        };
        if ($afterReservation) {
            Event::listen(SmsReserved::class, $mutate);
        } else {
            $mutate();
        }
        try {
            app(SmsDeliveryService::class)->send($delivery->id);
        } finally {
            Event::forget(SmsReserved::class);
        }
        $this->assertSame('blocked', $delivery->fresh()->state);
        $this->assertSame($afterReservation ? 1 : 0, DB::table('sms_attempts')->where('sms_delivery_id', $delivery->id)->count());
        $this->assertSame($afterReservation ? ['reservation'] : [], DB::table('sms_authorizations')->where('sms_delivery_id', $delivery->id)->orderBy('id')->pluck('gate')->all());
        $this->assertSame($publication ? 2 : 1, DB::table('delivery_receipts')->where('outbox_event_id', $delivery->receipt->outbox_event_id)->where('channel', 'in_app')->where('state', 'complete')->count());
        Http::assertNothingSent();
    }

    private function injectScopeChange(User $user): void
    {
        $other = Barangay::forceCreate(['name' => 'Fictional scope fault injection']);
        // Normal retained scoped FKs already refuse moving this user. Deliberate
        // isolated corruption verifies defense in depth, not a legal owner command.
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        try {
            DB::table('users')->where('id', $user->id)->update(['barangay_id' => $other->id]);
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    private function retract(OutboxEvent $event): void
    {
        $author = DB::table('announcements')->where('id', $event->resource_id)->value('author_id');
        app(CivicService::class)->retract(app(ReferenceData::class)->actorFor($author), $event->resource_id,
            ['expected_revision' => $this->publicationRevision, 'reason' => 'Fictional acceptance withdrawal']);
    }

    public function test_actual_source_definite_retry_rechecks_consent_and_retains_conservative_budget(): void
    {
        $delivery = $this->enqueue();
        $this->responseMode = 'rate_limited';
        app(SmsDeliveryService::class)->send($delivery->id);
        $this->assertSame('pending', $delivery->fresh()->state);
        Http::assertSentCount(1);
        $this->revoke($delivery->receipt->recipient, 'incident_review');
        $this->travel(2)->minutes();
        try {
            app(SmsDeliveryService::class)->send($delivery->id);
            $this->assertSame('blocked', $delivery->fresh()->state);
            $this->assertSame(1, $delivery->fresh()->attempts);
            $this->assertSame(1, (int) DB::table('messaging_budgets')->sum('reserved_segments'));
            Http::assertSentCount(1);
        } finally {
            $this->travelBack();
        }
    }

    public function test_actual_source_ambiguous_post_remains_uncertain_without_blind_retry(): void
    {
        $delivery = $this->enqueue();
        $this->responseMode = 'uncertain';
        app(SmsDeliveryService::class)->send($delivery->id);
        $this->assertSame('uncertain', $delivery->fresh()->state);
        app(SmsDeliveryService::class)->send($delivery->id);
        app(SmsDeliveryService::class)->reconcile($delivery->id);
        $this->assertSame('uncertain', $delivery->fresh()->state);
        $this->assertSame(1, $delivery->fresh()->attempts);
        $this->assertSame(1, DB::table('sms_attempts')->where('sms_delivery_id', $delivery->id)->count());
        $this->assertSame(['reservation', 'pre_send'], DB::table('sms_authorizations')->where('sms_delivery_id', $delivery->id)->orderBy('id')->pluck('gate')->all());
        $this->assertSame(1, DB::table('delivery_receipts')->where('outbox_event_id', $delivery->receipt->outbox_event_id)->where('channel', 'in_app')->where('state', 'complete')->count());
    }
}

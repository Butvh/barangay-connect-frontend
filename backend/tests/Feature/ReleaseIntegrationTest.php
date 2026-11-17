<?php

namespace Tests\Feature;

use App\Contracts\P2\Store;
use App\Http\Controllers\P2\CivicController;
use App\Models\OutboxEvent;
use App\Models\Verification;
use App\Providers\IntegrationServiceProvider;
use App\Services\Civic\CivicService;
use App\Services\Identity\CurrentSmsConsent;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\SmsDeliveryEligibility;
use App\Services\Identity\SmsEligibilityReferences;
use App\Services\Incidents\IncidentService;
use App\Services\Messaging\InAppNotificationHandler;
use App\Services\P2\Actor;
use App\Services\P2\Persistence\InAppHandler;
use App\Services\P2\Persistence\RelationalStore;
use App\Support\ApiProblem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class ReleaseIntegrationTest extends TestCase
{
    use CombinedMysql;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        Http::preventStrayRequests();
        config(['integration.release_enabled' => true, 'integration.sms_intent_enabled' => false]);
    }

    private function register(): void
    {
        (new IntegrationServiceProvider($this->app))->register();
    }

    private function actor($user): Actor
    {
        $identity = EffectiveIdentity::fromUser($user->fresh());

        return new Actor($identity->id, $identity->barangayId, $identity->role, $identity);
    }

    public function test_release_registers_actual_authority_without_any_test_selection(): void
    {
        $this->register();
        $this->assertTrue(config('integration.release_admitted'));
        $this->assertInstanceOf(RelationalStore::class, app(Store::class));
        $this->assertSame(app(CurrentSmsConsent::class), app(SmsEligibilityReferences::class));
        $this->assertSame(app(CurrentSmsConsent::class), app(SmsDeliveryEligibility::class));
        $this->assertInstanceOf(InAppHandler::class, app(InAppNotificationHandler::class));
        foreach (['test_bindings', 'admin_test_bindings', 'consent_test_bindings', 'sms_intent_test_bindings', 'photo_test_bindings'] as $flag) {
            $this->assertFalse(config('integration.'.$flag));
        }
    }

    public function test_container_producers_intersect_consent_and_replay_without_replacement_services(): void
    {
        config(['integration.sms_intent_enabled' => true]);
        $this->register();
        $resident = $this->sourceUser();
        Verification::forceCreate(['resident_id' => $resident->id, 'barangay_id' => $resident->barangay_id, 'review_status' => 'Approved']);
        $captain = $this->sourceUser('captain', $resident->barangay_id);
        $secretary = $this->sourceUser('secretary', $resident->barangay_id);
        $consent = app(CurrentSmsConsent::class);
        foreach ([[$captain, 'incident_review'], [$resident, 'barangay_announcements']] as [$user, $purpose]) {
            $consent->change($this->actor($user)->observedIdentity(), $purpose, ['state' => 'granted', 'expected_revision' => 0,
                'policy_version' => 'sms-consent.v1', 'template_version' => CurrentSmsConsent::TEMPLATES[$purpose]]);
        }
        $source = app(IncidentService::class)->create($this->actor($resident), [], 'release-source-once');
        app(IncidentService::class)->create($this->actor($resident), [], 'release-source-once');
        $event = OutboxEvent::where('type', 'incident.created.v2')->where('resource_id', $source['id'])->sole();
        $this->assertEqualsCanonicalizing([$captain->id, $secretary->id], $event->recipients->pluck('recipient_id')->all());
        $this->assertSame([$captain->id], $event->recipients->where('sms', true)->pluck('recipient_id')->all());
        $notice = app(CivicService::class)->publish($this->actor($captain), ['title' => 'Release notice', 'content' => 'Fictional test.'], 'release-publication-once');
        $publication = OutboxEvent::where('type', 'announcement.published.v2')->where('resource_id', $notice['id'])->where('barangay_id', $captain->barangay_id)->sole();
        $this->assertSame([$resident->id], $publication->recipients->where('sms', true)->pluck('recipient_id')->all());
        Http::assertNothingSent();
    }

    public function test_default_release_producer_remains_in_app_only(): void
    {
        $this->register();
        $captain = $this->sourceUser('captain');
        $notice = app(CivicService::class)->publish($this->actor($captain), ['title' => 'No SMS', 'content' => 'Fictional.'], 'release-default');
        $this->assertFalse(OutboxEvent::where('resource_id', $notice['id'])->where('type', 'announcement.published.v2')->sole()->recipients->contains('sms', true));
        Http::assertNothingSent();
    }

    public function test_release_self_profile_and_preferences_do_not_enable_other_administration(): void
    {
        $this->register();
        $user = $this->sourceUser('captain');
        $this->actingAs($user)->withSession(EffectiveIdentity::fromUser($user)->sessionSnapshot());
        $this->getJson('/api/v1/profile')->assertOk()->assertJsonPath('data.id', $user->id);
        $this->getJson('/api/v1/barangays')->assertOk();
        $url = '/api/v1/me/notification-preferences/incident_review';
        $this->getJson($url)->assertOk()->assertJsonPath('data.state', 'not_granted');
        $body = ['state' => 'granted', 'expected_revision' => 0, 'policy_version' => 'sms-consent.v1', 'template_version' => 'alert-review.v1'];
        $this->putJson($url, $body)->assertOk()->assertJsonPath('data.revision', 1);
        $this->putJson($url, array_replace($body, ['state' => 'revoked']))->assertConflict();
        $this->putJson($url, array_replace($body, ['state' => 'revoked', 'expected_revision' => 1]))->assertOk();
        $this->getJson('/api/v1/personnel')->assertStatus(503);
        $this->getJson('/api/v1/verifications')->assertStatus(503);
        $this->postJson('/api/v1/facilities', [])->assertStatus(503);
        $this->postJson('/api/v1/auth/register', [])->assertStatus(503);
    }

    public function test_release_general_lifecycle_is_denied_without_any_atomic_effect(): void
    {
        $this->register();
        $resident = $this->sourceUser();
        $captain = $this->sourceUser('captain', $resident->barangay_id);
        $row = app(CivicService::class)->submitFeedback($this->actor($resident),
            ['type' => 'general', 'rating' => 5, 'comment' => 'Preserve feedback.'], 'release-general-source');
        foreach (['reviewFeedback', 'archiveFeedback'] as $method) {
            $before = [];
            foreach (['activity_logs', 'idempotency_requests', 'outbox_events'] as $table) {
                $before[$table] = DB::table($table)->count();
            }
            $request = Request::create('/api/v1/feedback/'.$row['id'].'/review', 'POST', ['expected_revision' => 0]);
            $request->headers->set('Content-Type', 'application/json');
            $request->initialize([], [], [], [], [], ['CONTENT_TYPE' => 'application/json'], '{"expected_revision":0}');
            $request->headers->set('Idempotency-Key', 'release-denied-'.$method);
            $request->attributes->set('effective_identity', $this->actor($captain)->observedIdentity());
            try {
                app(CivicController::class)->$method($request, (string) $row['id']);
                $this->fail('Release exposed an excluded lifecycle action.');
            } catch (ApiProblem $error) {
                $this->assertSame(503, $error->status);
            }
            foreach ($before as $table => $count) {
                $this->assertSame($count, DB::table($table)->count());
            }
            $this->assertSame(0, (int) DB::table('community_feedback')->where('id', $row['id'])->value('revision'));
        }
    }

    #[DataProvider('unsafe')]
    public function test_release_rejects_unsafe_or_mixed_selection(array $configuration): void
    {
        config($configuration);
        $this->expectException(\LogicException::class);
        $this->register();
    }

    public static function unsafe(): array
    {
        return [
            [['integration.test_bindings' => true]],
            [['integration.p2_requested' => true]],
            [['integration.dispatch_enabled' => true, 'queue.default' => 'database', 'queue.connections.database.connection' => 'other']],
            [['integration.dispatch_enabled' => true, 'queue.default' => 'database', 'queue.connections.database.after_commit' => false]],
            [['integration.consent_test_bindings' => true]],
            [['integration.admin_test_bindings' => true]],
            [['identity.enabled' => false]],
            [['integration.contract_version' => 2]],
            [['integration.event_envelope_version' => 1]],
            [['integration.connection' => 'other']],
            [['database.connections.mysql.timezone' => '+08:00']],
            [['integration.store_adapter' => \stdClass::class]],
            [['integration.release_enabled' => false, 'integration.sms_intent_enabled' => true]],
        ];
    }
}

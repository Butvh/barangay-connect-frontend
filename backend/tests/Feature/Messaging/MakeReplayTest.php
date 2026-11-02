<?php

namespace Tests\Feature\Messaging;

use App\Models\SmsDelivery;
use App\Services\Messaging\MakeAutomationService;
use App\Services\Messaging\OutboxDispatcher;
use App\Services\Messaging\SmsDeliveryService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class MakeReplayTest extends MessagingTestCase
{
    protected function defineRoutes($router): void
    {
        $router->prefix('api/v1')->group(__DIR__.'/../../../routes/integrations.php');
    }

    protected function setUp(): void
    {
        parent::setUp();
        config(['messaging.make.enabled' => true, 'messaging.make.command_token' => str_repeat('t', 40),
            'messaging.make.barangay_id' => 1, 'messaging.make.webhook_url' => 'https://hook.eu1.make.com/FICTIONAL_WEBHOOK', 'messaging.make.webhook_api_key' => 'fake-key']);
    }

    private function command($event, array $override = []): array
    {
        return array_replace(['event_id' => $event->event_id, 'barangay_id' => 1, 'type' => 'announcement.published.v1', 'template_key' => 'announcement-review.v1', 'timestamp' => now()->timestamp], $override);
    }

    private function authenticated(): static
    {
        return $this->withHeaders(['Authorization' => 'Bearer '.str_repeat('t', 40), 'X-Credential-Id' => 'announcement-v1']);
    }

    public function test_nonurgent_waits_for_make_and_replays_queue_only_one_logical_sms(): void
    {
        $d = $this->prepare('announcement.published.v1');
        $event = $d->receipt->event;
        app(SmsDeliveryService::class)->send($d->id);
        Http::assertNothingSent();
        $this->authenticated()->postJson('/api/v1/integrations/make/sms-commands', $this->command($event))->assertStatus(202)->assertJsonPath('data.duplicate', false);
        $this->authenticated()->postJson('/api/v1/integrations/make/sms-commands', $this->command($event))->assertStatus(202)->assertJsonPath('data.duplicate', true);
        $this->assertSame(1, DB::table('make_commands')->count());
        Http::fake(['*' => Http::response([['message_id' => 701, 'recipient' => '639171234567', 'status' => 'Pending']])]);
        app(SmsDeliveryService::class)->send($d->id);
        app(SmsDeliveryService::class)->send($d->id);
        Http::assertSentCount(1);
    }

    public function test_forged_stale_cross_scope_and_arbitrary_relay_commands_are_rejected(): void
    {
        $event = $this->prepare('announcement.published.v1')->receipt->event;
        $this->postJson('/api/v1/integrations/make/sms-commands', $this->command($event))->assertStatus(401);
        $this->authenticated()->postJson('/api/v1/integrations/make/sms-commands', $this->command($event, ['timestamp' => now()->subMinutes(10)->timestamp]))->assertStatus(422);
        $this->authenticated()->postJson('/api/v1/integrations/make/sms-commands', $this->command($event, ['barangay_id' => 2]))->assertStatus(403);
        $this->authenticated()->postJson('/api/v1/integrations/make/sms-commands', $this->command($event, ['number' => '09171234567', 'message' => 'arbitrary']))->assertStatus(422);
        $this->assertSame(0, DB::table('make_commands')->count());
        Http::assertNothingSent();
    }

    public function test_make_webhook_payload_has_no_recipient_or_private_content_and_is_authenticated(): void
    {
        $this->prepare('announcement.published.v1');
        Http::fake(['*' => Http::response('Accepted', 200)]);
        app(MakeAutomationService::class)->dispatch(DB::table('make_dispatches')->value('id'));
        Http::assertSent(fn ($r) => $r->hasHeader('x-make-apikey', 'fake-key') && array_keys($r->data()) === ['event_id', 'barangay_id', 'type', 'template_key', 'timestamp']);
        $this->assertNotNull(DB::table('make_dispatches')->value('accepted_at'));
    }

    public function test_urgent_event_is_never_routed_to_make(): void
    {
        $this->prepare();
        $this->assertSame(0, DB::table('make_dispatches')->count());
    }

    public function test_v2_announcement_callback_and_replay_use_the_same_sms_ledger(): void
    {
        $event = $this->canonicalEvent(4, sms: true);
        app(OutboxDispatcher::class)->dispatchOne();
        $command = $this->command($event, ['type' => 'announcement.published.v2', 'template_key' => 'announcement-published.v2']);
        $this->authenticated()->postJson('/api/v1/integrations/make/sms-commands', $command)->assertStatus(202)->assertJsonPath('data.duplicate', false);
        $this->authenticated()->postJson('/api/v1/integrations/make/sms-commands', $command)->assertStatus(202)->assertJsonPath('data.duplicate', true);
        $this->assertSame(1, DB::table('make_commands')->count());
        $this->assertSame(1, DB::table('sms_deliveries')->count());
        $this->assertSame('announcement-review.v1', SmsDelivery::firstOrFail()->receipt->template_key);
    }
}

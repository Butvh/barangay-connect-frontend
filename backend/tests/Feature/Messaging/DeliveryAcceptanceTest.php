<?php

namespace Tests\Feature\Messaging;

use App\Models\SmsDelivery;
use App\Services\Messaging\OutboxDispatcher;
use App\Services\Messaging\SmsDeliveryService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/** Delivery fixtures only; no production P2 SMS-intent adoption is implied. */
class DeliveryAcceptanceTest extends MessagingTestCase
{
    protected function defineRoutes($router): void
    {
        $router->prefix('api/v1')->group(__DIR__.'/../../../routes/integrations.php');
    }

    private function makeCommand($event, array $patch = []): array
    {
        return array_replace(['event_id' => $event->event_id, 'barangay_id' => 1, 'type' => $event->type, 'template_key' => $event->template_key, 'timestamp' => now()->timestamp], $patch);
    }

    private function makeCredential(string $id = 'announcement-v1'): static
    {
        config(['messaging.make.enabled' => true, 'messaging.make.command_token' => str_repeat('t', 40), 'messaging.make.barangay_id' => 1]);

        return $this->withHeaders(['Authorization' => 'Bearer '.str_repeat('t', 40), 'X-Credential-Id' => $id]);
    }

    public function test_correct_token_with_wrong_credential_scope_cannot_accept_a_command(): void
    {
        $event = $this->canonicalEvent(4, sms: true);
        app(OutboxDispatcher::class)->dispatchOne($event->event_id);
        $this->makeCredential('unreviewed-credential')->postJson('/api/v1/integrations/make/sms-commands', $this->makeCommand($event))->assertStatus(401);
        $this->assertSame(0, DB::table('make_commands')->count());
        Http::assertNothingSent();
    }

    public function test_make_cannot_change_a_v2_template_or_add_sms_to_an_in_app_only_event(): void
    {
        $sms = $this->canonicalEvent(4, sms: true);
        $inApp = $this->canonicalEvent(4);
        app(OutboxDispatcher::class)->dispatchOne($sms->event_id);
        app(OutboxDispatcher::class)->dispatchOne($inApp->event_id);
        $this->makeCredential()->postJson('/api/v1/integrations/make/sms-commands', $this->makeCommand($sms, ['template_key' => 'announcement-review.v1']))->assertStatus(403);
        $this->makeCredential()->postJson('/api/v1/integrations/make/sms-commands', $this->makeCommand($inApp))->assertStatus(403);
        $this->assertSame(0, DB::table('make_commands')->count());
        $this->assertSame(1, DB::table('sms_deliveries')->count());
        Http::assertNothingSent();
    }

    public function test_shared_segment_budget_blocks_second_v2_delivery_without_repeating_in_app(): void
    {
        config(['messaging.sms.daily_segment_budget' => 1]);
        $events = [$this->canonicalEvent(0, sms: true), $this->canonicalEvent(0, sms: true)];
        foreach ($events as $event) {
            app(OutboxDispatcher::class)->dispatchOne($event->event_id);
        }
        Http::fake(['*' => Http::response([['message_id' => 801, 'recipient' => '639171234567', 'status' => 'Queued']])]);
        $deliveries = SmsDelivery::orderBy('id')->get();
        foreach ($deliveries as $delivery) {
            app(SmsDeliveryService::class)->send($delivery->id);
        }
        app(SmsDeliveryService::class)->send($deliveries[0]->id);
        Http::assertSentCount(1);
        $this->assertSame('accepted', $deliveries[0]->fresh()->state);
        $this->assertSame('daily_budget_exhausted', $deliveries[1]->fresh()->last_error);
        $this->assertSame(1, (int) DB::table('messaging_budgets')->sum('reserved_segments'));
        $this->assertSame(1, DB::table('sms_attempts')->count());
        $this->assertSame(2, DB::table('delivery_receipts')->where(['channel' => 'in_app', 'state' => 'complete'])->count());
        $this->assertSame(2, DB::table('notifications')->count());
        $this->assertSame(0, DB::table('make_dispatches')->count());
    }
}

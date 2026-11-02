<?php

namespace Tests\Feature\Messaging;

use App\Models\SmsDelivery;
use App\Services\Messaging\OutboxDispatcher;
use App\Services\Messaging\SmsDeliveryService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class SmsUncertainSendTest extends MessagingTestCase
{
    public function test_timeout_and_duplicate_jobs_never_blindly_resend(): void
    {
        $d = $this->prepare();
        $calls = 0;
        Http::fake(function () use (&$calls) {
            $calls++;
            throw new ConnectionException('recipient and secret must not escape');
        });
        app(SmsDeliveryService::class)->send($d->id);
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertSame('uncertain', $d->fresh()->state);
        $this->assertSame(1, $calls);
        $this->assertSame('transport_uncertain', $d->fresh()->last_error);
        $this->assertSame(1, DB::table('sms_attempts')->count());
        $this->assertStringNotContainsString('639171234567', DB::table('sms_deliveries')->value('destination'));
    }

    public function test_expired_sending_claim_is_uncertain_after_worker_restart(): void
    {
        $d = $this->prepare();
        $d->forceFill(['state' => 'sending', 'claim_token' => (string) Str::uuid(), 'lease_until' => now()->subMinute()])->save();
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertSame('uncertain', $d->fresh()->state);
        Http::assertNothingSent();
    }

    public function test_duplicate_dispatch_and_send_leave_one_logical_delivery_and_one_transport_attempt(): void
    {
        $d = $this->prepare();
        app(OutboxDispatcher::class)->dispatchOne();
        Http::fake(['*' => Http::response([['message_id' => 501, 'recipient' => '639171234567', 'status' => 'Queued']])]);
        app(SmsDeliveryService::class)->send($d->id);
        app(SmsDeliveryService::class)->send($d->id);
        Http::assertSentCount(1);
        $this->assertSame(1, SmsDelivery::count());
        $this->assertSame(1, DB::table('notifications')->count());
        $this->assertSame('accepted', $d->fresh()->state);
        $this->assertSame('Queued', $d->fresh()->provider_status);
        $this->assertSame('pending', $d->fresh()->receipt->state);
    }

    public function test_reconciliation_uses_get_and_sent_means_network_sent(): void
    {
        $d = $this->prepare();
        Http::fake(fn ($r) => Http::response([['message_id' => 501, 'recipient' => '639171234567', 'status' => $r->method() === 'GET' ? 'Sent' : 'Queued']]));
        app(SmsDeliveryService::class)->send($d->id);
        $d->fresh()->forceFill(['reconcile_at' => now()->subMinute()])->save();
        app(SmsDeliveryService::class)->reconcile($d->id);
        $this->assertSame('network_sent', $d->fresh()->state);
        $this->assertSame('complete', $d->fresh()->receipt->state);
        Http::assertSent(fn ($r) => $r->method() === 'GET' && str_contains($r->url(), '/messages/501'));
    }

    public function test_429_records_definite_rejection_and_waits_for_retry_after(): void
    {
        $d = $this->prepare();
        Http::fake(['*' => Http::response([], 429, ['Retry-After' => '600'])]);
        app(SmsDeliveryService::class)->send($d->id);
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertSame('pending', $d->fresh()->state);
        $this->assertTrue($d->fresh()->next_attempt_at->gte(now()->addSeconds(590)));
        $this->assertSame('rejected', DB::table('sms_attempts')->value('outcome'));
        Http::assertSentCount(1);
    }

    public function test_low_balance_is_visible_and_requires_operator_action(): void
    {
        $d = $this->prepare();
        Http::fake(['*' => Http::response(['message' => 'Insufficient credit balance'], 402)]);
        app(SmsDeliveryService::class)->send($d->id);
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertSame('blocked', $d->fresh()->state);
        $this->assertSame('low_balance', $d->fresh()->last_error);
        Http::assertSentCount(1);
    }

    public function test_malformed_success_is_uncertain(): void
    {
        $d = $this->prepare();
        Http::fake(['*' => Http::response(['unexpected' => true])]);
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertSame('uncertain', $d->fresh()->state);
        $this->assertSame('malformed_provider_response', $d->fresh()->last_error);
    }

    public function test_disabled_provider_and_budget_guards_do_not_call_http(): void
    {
        $d = $this->prepare();
        config(['messaging.sms.enabled' => false]);
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertSame('provider_disabled', $d->fresh()->last_error);
        config(['messaging.sms.enabled' => true, 'messaging.sms.daily_segment_budget' => 0]);
        $d->fresh()->forceFill(['state' => 'pending'])->save();
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertSame('daily_budget_exhausted', $d->fresh()->last_error);
        Http::assertNothingSent();
    }
}

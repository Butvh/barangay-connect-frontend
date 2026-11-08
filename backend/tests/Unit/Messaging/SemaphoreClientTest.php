<?php

namespace Tests\Unit\Messaging;

use App\Services\Messaging\PhoneNumber;
use App\Services\Messaging\SemaphoreClient;
use App\Services\Messaging\TransportFailure;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\DbaTestCase;

class SemaphoreClientTest extends DbaTestCase
{
    public function test_numbers_are_normalized_and_arbitrary_international_destinations_rejected(): void
    {
        $this->assertSame('639171234567', PhoneNumber::normalize('+63 917 123 4567'));
        $this->assertSame('639171234567', PhoneNumber::normalize('09171234567'));
        $this->expectException(\InvalidArgumentException::class);
        PhoneNumber::normalize('+12025550123');
    }

    public function test_acceptance_preserves_provider_status_and_never_claims_handset_delivery(): void
    {
        Http::fake(['*' => Http::response([['message_id' => 123, 'recipient' => '639171234567', 'status' => 'Queued']])]);
        $result = app(SemaphoreClient::class)->send('639171234567', 'Barangay Connect: please review your assigned alert.');
        $this->assertSame('Queued', $result['status']);
        Http::assertSent(fn ($r) => $r->url() === 'https://api.semaphore.co/api/v4/messages' && $r['sendername'] === 'Approved');
    }

    public function test_timeout_is_uncertain_and_never_automatically_retried(): void
    {
        $calls = 0;
        Http::fake(function () use (&$calls) {
            $calls++;
            throw new ConnectionException('private transport detail');
        });
        try {
            app(SemaphoreClient::class)->send('639171234567', 'Barangay Connect: review your alert.');
            $this->fail('Expected failure');
        } catch (TransportFailure $e) {
            $this->assertTrue($e->uncertain);
            $this->assertSame('transport_uncertain', $e->getMessage());
        }
        $this->assertSame(1, $calls);
    }

    public function test_rate_limit_respects_retry_after(): void
    {
        Http::fake(['*' => Http::response([], 429, ['Retry-After' => '120'])]);
        try {
            app(SemaphoreClient::class)->send('639171234567', 'Barangay Connect: review your alert.');
            $this->fail('Expected rate limit');
        } catch (TransportFailure $e) {
            $this->assertFalse($e->uncertain);
            $this->assertSame(120, $e->retryAfter);
        }
    }

    public function test_reconciliation_rate_limit_and_encoding_costs(): void
    {
        $this->assertSame(1, SemaphoreClient::segments(str_repeat('a', 160)));
        $this->assertSame(2, SemaphoreClient::segments(str_repeat('a', 161)));
        $this->assertSame(2, SemaphoreClient::segments(str_repeat('^', 81)));
        Http::fake(['*' => Http::response([], 429, ['Retry-After' => '900'])]);
        try {
            app(SemaphoreClient::class)->status('123', '639171234567');
            $this->fail('Expected throttle');
        } catch (TransportFailure $e) {
            $this->assertSame(900, $e->retryAfter);
        }
    }

    public function test_silently_ignored_test_prefix_is_rejected_without_transport(): void
    {
        try {
            app(SemaphoreClient::class)->send('639171234567', 'TEST message');
            $this->fail('Expected rejection');
        } catch (TransportFailure $e) {
            $this->assertSame('unsupported_message', $e->getMessage());
        }
        Http::assertNothingSent();
    }
}

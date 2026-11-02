<?php

namespace App\Services\Messaging;

use Illuminate\Support\Facades\Http;

final class SemaphoreClient
{
    private const URL = 'https://api.semaphore.co/api/v4/messages';

    private const STATUSES = ['Queued', 'Pending', 'Sent', 'Failed', 'Refunded'];

    public function send(string $number, string $message): array
    {
        $number = PhoneNumber::normalize($number);
        if (! config('messaging.sms.enabled') || ! config('messaging.sms.key') || ! config('messaging.sms.sender')) {
            throw new TransportFailure('provider_disabled');
        }
        if (preg_match('/^TEST/i', $message) || ! preg_match('/^[\x20-\x7E]+$/D', $message)) {
            throw new TransportFailure('unsupported_message');
        }
        try {
            // No automatic HTTP retries: a timed-out POST may already have charged the account.
            $response = Http::asForm()->connectTimeout(5)->timeout(config('messaging.sms.timeout', 15))
                ->withOptions(['allow_redirects' => false])->post(self::URL, [
                    'apikey' => config('messaging.sms.key'), 'sendername' => config('messaging.sms.sender'),
                    'number' => $number, 'message' => $message,
                ]);
        } catch (\Throwable) {
            throw new TransportFailure('transport_uncertain', uncertain: true);
        }
        if ($response->status() === 429) {
            throw new TransportFailure('rate_limited', retryAfter: $this->retryAfter($response->header('Retry-After')), httpStatus: 429);
        }
        if ($response->serverError() || $response->redirect()) {
            throw new TransportFailure('provider_uncertain', uncertain: true, httpStatus: $response->status());
        }
        if (! $response->successful()) {
            // Provider bodies are classified in memory and never persisted or logged.
            $lowBalance = preg_match('/balance|credit/i', $response->body());
            throw new TransportFailure($lowBalance ? 'low_balance' : 'provider_rejected', httpStatus: $response->status());
        }

        return $this->parse($response->json(), $number);
    }

    public function status(string $id, string $number): array
    {
        if (! preg_match('/^[0-9]+$/D', $id)) {
            throw new TransportFailure('invalid_provider_id');
        }
        try {
            $response = Http::connectTimeout(5)->timeout(15)->withOptions(['allow_redirects' => false])
                ->get(self::URL.'/'.$id, ['apikey' => config('messaging.sms.key')]);
        } catch (\Throwable) {
            throw new TransportFailure('reconciliation_unavailable');
        }
        if ($response->status() === 429) {
            throw new TransportFailure('reconciliation_rate_limited', retryAfter: $this->retryAfter($response->header('Retry-After')), httpStatus: 429);
        }
        if (! $response->successful()) {
            throw new TransportFailure('reconciliation_unavailable', retryAfter: 60);
        }
        $result = $this->parse($response->json(), $number);
        if ((string) $result['message_id'] !== $id) {
            throw new TransportFailure('provider_id_mismatch');
        }

        return $result;
    }

    public static function segments(string $message): int
    {
        // Conservative GSM-7 subset: extension characters cost two septets. Unicode is rejected.
        if (! preg_match('/^[\x20-\x7E]+$/D', $message)) {
            throw new \InvalidArgumentException('unsupported_encoding');
        }
        $units = strlen($message) + preg_match_all('/[\^{}\\\\\[\]~|]/', $message);
        // Backtick is outside GSM-7. Fixed templates never include it.
        if (str_contains($message, '`')) {
            throw new \InvalidArgumentException('unsupported_encoding');
        }

        return $units <= 160 ? 1 : (int) ceil($units / 153);
    }

    private function parse(mixed $body, string $number): array
    {
        if (is_array($body) && isset($body['message_id'])) {
            $body = [$body];
        }
        if (! is_array($body) || count($body) !== 1 || ! isset($body[0]['message_id'], $body[0]['recipient'], $body[0]['status'])
            || ! preg_match('/^[0-9]+$/D', (string) $body[0]['message_id']) || ! in_array($body[0]['status'], self::STATUSES, true)) {
            throw new TransportFailure('malformed_provider_response', uncertain: true);
        }
        try {
            $recipient = PhoneNumber::normalize((string) $body[0]['recipient']);
        } catch (\InvalidArgumentException) {
            throw new TransportFailure('provider_recipient_mismatch', uncertain: true);
        }
        if ($recipient !== $number) {
            throw new TransportFailure('provider_recipient_mismatch', uncertain: true);
        }

        return ['message_id' => (string) $body[0]['message_id'], 'status' => $body[0]['status']];
    }

    private function retryAfter(string $header): int
    {
        return max(1, ctype_digit($header) ? (int) $header : max(60, (int) strtotime($header) - time()));
    }
}

<?php

namespace App\Services\Messaging;

use App\Models\MakeDispatch;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

final class MakeAutomationService
{
    public function dispatch(int $id): void
    {
        if (DB::transactionLevel() !== 0) {
            throw new \LogicException('make_requires_committed_connection');
        }
        if (! config('messaging.make.enabled')) {
            return;
        }
        $url = config('messaging.make.webhook_url');
        if (parse_url($url, PHP_URL_SCHEME) !== 'https' || ! preg_match('/^hook(?:\.[a-z0-9-]+)?\.make\.com$/D', parse_url($url, PHP_URL_HOST) ?? '') || ! config('messaging.make.webhook_api_key')) {
            return;
        }
        $dispatch = DB::transaction(function () use ($id) {
            $d = MakeDispatch::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($d->command_received_at || $d->attempts >= config('messaging.make.max_attempts') || $d->lease_until?->isFuture() || $d->next_attempt_at?->isFuture()) {
                return null;
            }
            $definition = EventContract::definition($d->event);
            if ($definition['route'] !== 'make' || $d->event->barangay_id !== config('messaging.make.barangay_id')) {
                return null;
            }
            $d->forceFill(['claim_token' => (string) Str::uuid(), 'lease_until' => now()->addSeconds(90), 'attempts' => $d->attempts + 1])->save();

            return $d;
        });
        if (! $dispatch) {
            return;
        }
        try {
            $event = $dispatch->event;
            $response = Http::connectTimeout(5)->timeout(15)->withOptions(['allow_redirects' => false])
                ->withHeaders(['x-make-apikey' => config('messaging.make.webhook_api_key')])->post($url, [
                    'event_id' => $event->event_id, 'barangay_id' => $event->barangay_id, 'type' => $event->type,
                    'template_key' => $event->template_key, 'timestamp' => now()->timestamp,
                ]);
            $accepted = $response->successful();
        } catch (\Throwable) {
            $accepted = false;
        }
        // Make retries are safe only because the callback is a deduplicated Laravel command.
        MakeDispatch::whereKey($id)->where('claim_token', $dispatch->claim_token)->update([
            'accepted_at' => $accepted ? now() : null, 'claim_token' => null, 'lease_until' => null,
            'last_error' => $accepted ? null : 'make_unavailable',
            'next_attempt_at' => now()->addSeconds(max(300, 30 * 2 ** $dispatch->attempts) + random_int(1, 30)),
        ]);
    }
}

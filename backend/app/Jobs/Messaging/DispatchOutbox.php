<?php

namespace App\Jobs\Messaging;

use App\Models\MakeDispatch;
use App\Models\SmsDelivery;
use App\Services\Messaging\OutboxDispatcher;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

final class DispatchOutbox implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 60;

    public function handle(OutboxDispatcher $dispatcher): void
    {
        for ($i = 0; $i < 100 && $dispatcher->dispatchOne(); $i++) {
        }
        // Durable scan closes the commit -> job-enqueue crash gap. Duplicate queued jobs are safe.
        foreach (['urgent' => 'sms-urgent', 'make' => 'sms-default'] as $route => $queue) {
            $types = array_keys(array_filter(config('messaging.events'), fn ($definition) => $definition['route'] === $route));
            SmsDelivery::whereIn('state', ['pending', 'sending'])
                ->where(fn ($q) => $q->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now()))
                ->whereHas('receipt.event', function ($q) use ($types, $route) {
                    $q->whereIn('type', $types);
                    if ($route === 'make') {
                        $q->whereHas('automation', fn ($a) => $a->whereNotNull('command_received_at'));
                    }
                })
                ->orderBy('id')->limit(500)->get()->each(fn ($d) => SendSms::dispatch($d->id)->onQueue($queue));
        }
        SmsDelivery::whereNotNull('provider_message_id')->whereIn('state', ['accepted', 'failed', 'uncertain'])
            ->where(fn ($q) => $q->whereNull('reconcile_at')->orWhere('reconcile_at', '<=', now()))->limit(30)->get()
            ->each(fn ($d) => ReconcileSms::dispatch($d->id)->onQueue('sms-reconcile'));
        MakeDispatch::whereNull('command_received_at')->where('attempts', '<', config('messaging.make.max_attempts'))
            ->where(fn ($q) => $q->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now()))->limit(100)->get()
            ->each(fn ($d) => DispatchMake::dispatch($d->id)->onQueue('automation'));
    }
}

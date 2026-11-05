<?php

namespace App\Jobs\Messaging;

use App\Services\Messaging\SmsDeliveryService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

final class ReconcileSms implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 30;

    public function __construct(public readonly int $deliveryId) {}

    public function handle(SmsDeliveryService $service): void
    {
        $service->reconcile($this->deliveryId);
    }
}

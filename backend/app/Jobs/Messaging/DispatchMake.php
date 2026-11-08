<?php

namespace App\Jobs\Messaging;

use App\Services\Messaging\MakeAutomationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

final class DispatchMake implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 30;

    public function __construct(public readonly int $dispatchId) {}

    public function handle(MakeAutomationService $service): void
    {
        $service->dispatch($this->dispatchId);
    }
}

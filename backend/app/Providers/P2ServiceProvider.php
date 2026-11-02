<?php

declare(strict_types=1);

namespace App\Providers;

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Services\Audit\AuditRecorder;
use App\Services\Civic\CivicService;
use App\Services\Incidents\IncidentService;
use App\Services\Incidents\OverviewService;
use App\Services\Messaging\CreateInAppNotification;
use App\Services\Messaging\NotificationService;
use App\Services\Messaging\OutboxWriter;
use App\Services\Reports\ReportService;
use Illuminate\Support\ServiceProvider;

final class P2ServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $clock = static fn () => gmdate('Y-m-d\TH:i:s\Z');
        foreach ([AuditRecorder::class, OutboxWriter::class] as $class) {
            $this->app->scoped($class, fn ($app) => new $class($app->make(Store::class), $clock));
        }
        foreach ([IncidentService::class, CivicService::class] as $class) {
            $this->app->scoped($class, fn ($app) => new $class($app->make(Store::class), $app->make(ReferenceData::class), $app->make(AuditRecorder::class), $app->make(OutboxWriter::class), $clock));
        }
        foreach ([CreateInAppNotification::class, NotificationService::class] as $class) {
            $this->app->scoped($class, fn ($app) => new $class($app->make(Store::class), $app->make(ReferenceData::class), $clock));
        }
        $this->app->scoped(OverviewService::class, fn ($app) => new OverviewService($app->make(Store::class), $app->make(ReferenceData::class), $app->make(IncidentService::class), $app->make(CivicService::class), $clock));
        $this->app->scoped(ReportService::class, fn ($app) => new ReportService($app->make(Store::class), $app->make(ReferenceData::class), $clock, $app->make(IncidentService::class), $app->make(CivicService::class)));
        // P1 and DBA must bind both ports. No production memory store or demo-auth fallback.
    }
}

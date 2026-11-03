<?php

declare(strict_types=1);

namespace App\Providers;

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Contracts\References\IncidentReferenceAuthorization;
use App\Services\Audit\AuditRecorder;
use App\Services\Civic\CivicService;
use App\Services\Incidents\IncidentService;
use App\Services\Incidents\OverviewService;
use App\Services\Messaging\NotificationService;
use App\Services\Messaging\OutboxWriter;
use App\Services\P2\Persistence\IncidentReferencePolicy;
use App\Services\Reports\ReportService;
use Illuminate\Support\ServiceProvider;

final class P2ServiceProvider extends ServiceProvider
{
    public const P1_CONTRACT_VERSION = 1;

    public function register(): void
    {
        // P1 selects reviewed implementations before registering this provider.
        // Never replace those bindings or enable an unreviewed notification handler.
        foreach ([Store::class, ReferenceData::class, \App\Contracts\Events\AuditRecorder::class, \App\Contracts\Events\OutboxWriter::class] as $port) {
            if (! $this->app->bound($port)) {
                throw new \LogicException('P1 must select the reviewed P2 binding: '.$port);
            }
        }
        $clock = static fn () => gmdate('Y-m-d\TH:i:s\Z');
        $this->app->bindIf(IncidentReferenceAuthorization::class, IncidentReferencePolicy::class);
        $this->app->scoped(AuditRecorder::class, fn ($app) => new AuditRecorder($app->make(Store::class), $clock, $app->make(\App\Contracts\Events\AuditRecorder::class)));
        $this->app->scoped(OutboxWriter::class, fn ($app) => new OutboxWriter($app->make(Store::class), $clock, $app->make(\App\Contracts\Events\OutboxWriter::class)));
        foreach ([IncidentService::class, CivicService::class] as $class) {
            $this->app->scoped($class, fn ($app) => new $class($app->make(Store::class), $app->make(ReferenceData::class), $app->make(AuditRecorder::class), $app->make(OutboxWriter::class), $clock));
        }
        foreach ([NotificationService::class] as $class) {
            $this->app->scoped($class, fn ($app) => new $class($app->make(Store::class), $app->make(ReferenceData::class), $clock));
        }
        $this->app->scoped(OverviewService::class, fn ($app) => new OverviewService($app->make(Store::class), $app->make(ReferenceData::class), $app->make(IncidentService::class), $app->make(CivicService::class), $clock));
        $this->app->scoped(ReportService::class, fn ($app) => new ReportService($app->make(Store::class), $app->make(ReferenceData::class), $clock, $app->make(IncidentService::class), $app->make(CivicService::class)));
        // P1 owns provider registration. All dependencies are current owner models/contracts.
    }
}

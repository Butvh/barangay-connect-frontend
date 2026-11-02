<?php

namespace App\Providers;

use App\Contracts\Events\AuditRecorder;
use App\Contracts\Events\OutboxWriter;
use App\Jobs\Messaging\DispatchOutbox;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\ServiceProvider;
use LogicException;

/** Registers owner-supplied implementations only after the shared contract is reviewed. */
final class IntegrationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        if (! config('integration.p2_enabled')) {
            if (config('integration.dispatch_enabled')) {
                throw new LogicException('Outbox dispatch requires the reviewed module and handler bindings.');
            }

            return;
        }
        $provider = 'App\\Providers\\P2ServiceProvider';
        if (! config('identity.enabled') || ! class_exists($provider) ||
            ! defined($provider.'::P1_CONTRACT_VERSION') || $provider::P1_CONTRACT_VERSION !== 1) {
            throw new LogicException('The reviewed P1/P2 v1 session and event contract is required.');
        }
        if (config('database.default') !== config('integration.connection') ||
            config('database.connections.'.config('integration.connection').'.driver') !== 'mysql') {
            throw new LogicException('All integrated services must use the same named MySQL connection.');
        }
        foreach ([
            'App\\Contracts\\P2\\Store' => 'store_adapter',
            'App\\Contracts\\P2\\ReferenceData' => 'reference_adapter',
            AuditRecorder::class => 'audit_adapter',
            OutboxWriter::class => 'outbox_adapter',
        ] as $port => $key) {
            $this->bindReviewed($port, $key);
        }
        $this->app->register($provider);
        if (config('integration.dispatch_enabled')) {
            $this->bindReviewed('App\\Services\\Messaging\\InAppNotificationHandler', 'notification_adapter');
            if (config('queue.default') !== 'database' || config('queue.connections.database.retry_after') <= 90 ||
                ! class_exists('App\\Jobs\\Messaging\\DispatchOutbox')) {
                throw new LogicException('Reviewed database queue/dispatcher configuration is required.');
            }
        }
    }

    private function bindReviewed(string $port, string $key): void
    {
        $adapter = config('integration.'.$key);
        if (! interface_exists($port) || ! is_string($adapter) || ! is_subclass_of($adapter, $port)) {
            throw new LogicException('An owner-supplied compatible integration adapter is missing.');
        }
        $this->app->scoped($port, $adapter);
    }

    public function boot(): void
    {
        if (config('integration.dispatch_enabled')) {
            Schedule::job(new DispatchOutbox, 'messaging-control', 'database')
                ->everyMinute()->withoutOverlapping();
        }
    }
}

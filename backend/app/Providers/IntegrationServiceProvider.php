<?php

namespace App\Providers;

use App\Contracts\Events\AuditRecorder;
use App\Contracts\Events\OutboxWriter;
use App\Jobs\Messaging\DispatchOutbox;
use App\Services\Identity\CurrentSmsConsent;
use App\Services\Identity\SmsDeliveryEligibility;
use App\Services\Identity\SmsEligibilityReferences;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\ServiceProvider;
use LogicException;

/** Registers owner-supplied implementations only after the shared contract is reviewed. */
final class IntegrationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $testBindings = (bool) config('integration.test_bindings');
        if ((config('integration.consent_test_bindings') || config('integration.admin_test_bindings')) && ! $testBindings) {
            throw new LogicException('Current consent bindings require the reviewed disposable profile.');
        }
        if ($testBindings || config('integration.p2_enabled')) {
            $this->assertIsolatedBuild();
        }
        if ($testBindings) {
            foreach (config('integration.reviewed_test_adapters', []) as $key => $adapter) {
                config(['integration.'.$key => $adapter]);
            }
        }
        if (! config('integration.p2_enabled') && ! $testBindings) {
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
        if (config('integration.consent_test_bindings')) {
            $this->app->scoped(CurrentSmsConsent::class);
            $this->app->alias(CurrentSmsConsent::class, SmsEligibilityReferences::class);
            $this->app->alias(CurrentSmsConsent::class, SmsDeliveryEligibility::class);
        }
        if ($testBindings) {
            $this->bindReviewed('App\\Services\\Messaging\\InAppNotificationHandler', 'notification_adapter');
        }
        if (config('integration.dispatch_enabled')) {
            $this->bindReviewed('App\\Services\\Messaging\\InAppNotificationHandler', 'notification_adapter');
            if (config('queue.default') !== 'database' || config('queue.connections.database.retry_after') <= 90 ||
                ! class_exists('App\\Jobs\\Messaging\\DispatchOutbox')) {
                throw new LogicException('Reviewed database queue/dispatcher configuration is required.');
            }
        }
    }

    private function assertIsolatedBuild(): void
    {
        $name = config('database.connections.mysql.database');
        $httpHarness = $this->app->environment('local') && (
            (getenv('P2_TEST_HTTP') === '1' && str_starts_with((string) $name, 'p2_test_')) ||
            (getenv('P1_OPERATIONAL_BROWSER') === '1' && str_starts_with((string) $name, 'bc_dba_p1_'))
        );
        if ((! $this->app->environment('testing') && ! $httpHarness) || getenv('DB_TEST_DISPOSABLE') !== '1' ||
            ! is_string($name) || ! preg_match('/^(?:bc_dba_p[12]_|p2_test_)[A-Za-z0-9_]+$/D', $name) ||
            $name !== getenv('DB_TEST_DATABASE') || config('integration.dispatch_enabled') ||
            config('messaging.sms.enabled', false) || config('messaging.make.enabled', false)) {
            throw new LogicException('P2 bindings/modules are restricted to the reviewed disposable test build until form and lock-order acceptance.');
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

<?php

namespace App\Providers;

use App\Contracts\Events\AuditRecorder;
use App\Contracts\Events\OutboxWriter;
use App\Contracts\P2\IncidentPhotoAuthorization;
use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Contracts\Photos\IncidentPhotos;
use App\Jobs\Messaging\DispatchOutbox;
use App\Services\Civic\CivicService;
use App\Services\Identity\CurrentSmsConsent;
use App\Services\Identity\SmsDeliveryEligibility;
use App\Services\Identity\SmsEligibilityReferences;
use App\Services\Incidents\IncidentService;
use App\Services\P2\Persistence\InAppHandler;
use App\Services\P2\Persistence\IncidentPhotoPolicy;
use App\Services\P2\Persistence\RelationalStore;
use App\Services\P2\Persistence\TypedAuditRecorder;
use App\Services\P2\Persistence\TypedOutboxWriter;
use App\Services\Photos\PrivateIncidentPhotos;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\ServiceProvider;
use LogicException;

/** Registers owner-supplied implementations only after the shared contract is reviewed. */
final class IntegrationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        config(['integration.release_admitted' => false]);
        $release = (bool) config('integration.release_enabled');
        if (config('integration.sms_intent_enabled') && ! $release) {
            throw new LogicException('Release SMS intent requires reviewed release admission.');
        }
        $testBindings = (bool) config('integration.test_bindings');
        if ($release) {
            $this->selectReleaseAdapters();
        }
        if ((config('integration.consent_test_bindings') || config('integration.admin_test_bindings') ||
            config('integration.photo_test_bindings') || config('integration.sms_intent_test_bindings')) && ! $testBindings) {
            throw new LogicException('Additional integration bindings require the reviewed disposable profile.');
        }
        if (! $release && ($testBindings || config('integration.p2_enabled'))) {
            $this->assertIsolatedBuild();
        }
        if ($testBindings) {
            foreach (config('integration.reviewed_test_adapters', []) as $key => $adapter) {
                config(['integration.'.$key => $adapter]);
            }
        }
        if (! $release && ! config('integration.p2_enabled') && ! $testBindings) {
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
        if ($release || config('integration.consent_test_bindings')) {
            $this->app->scoped(CurrentSmsConsent::class);
            $this->app->alias(CurrentSmsConsent::class, SmsEligibilityReferences::class);
            $this->app->alias(CurrentSmsConsent::class, SmsDeliveryEligibility::class);
        }
        if (config('integration.photo_test_bindings')) {
            $this->app->scoped(IncidentPhotoAuthorization::class, IncidentPhotoPolicy::class);
            $this->app->scoped(IncidentPhotos::class, PrivateIncidentPhotos::class);
        }
        if (($release && config('integration.sms_intent_enabled')) || config('integration.sms_intent_test_bindings')) {
            if ((! $release && ! config('integration.consent_test_bindings')) || config('integration.outbox_adapter') !== TypedOutboxWriter::class) {
                throw new LogicException('Optional SMS intent requires the actual reviewed consent authority and typed writer.');
            }
            $this->app->scoped(OutboxWriter::class, fn () => new TypedOutboxWriter(allowSmsIntent: true));
        }
        if (($release && config('integration.sms_intent_enabled')) || config('integration.photo_test_bindings') || config('integration.sms_intent_test_bindings')) {
            $clock = static fn () => gmdate('Y-m-d\TH:i:s\Z');
            $dependencies = fn ($app) => [$app->make(Store::class), $app->make(ReferenceData::class),
                $app->make(\App\Services\Audit\AuditRecorder::class), $app->make(\App\Services\Messaging\OutboxWriter::class), $clock];
            $sms = fn ($app) => (($release && config('integration.sms_intent_enabled')) || config('integration.sms_intent_test_bindings')) ? $app->make(SmsEligibilityReferences::class) : null;
            $this->app->scoped(IncidentService::class, fn ($app) => new IncidentService(
                ...[...$dependencies($app), config('integration.photo_test_bindings') ? $app->make(IncidentPhotos::class) : null, $sms($app)]));
            $this->app->scoped(CivicService::class, fn ($app) => new CivicService(...[...$dependencies($app), $sms($app)]));
        }
        if ($release || $testBindings) {
            $this->bindReviewed('App\\Services\\Messaging\\InAppNotificationHandler', 'notification_adapter');
        }
        if (config('integration.dispatch_enabled')) {
            $this->bindReviewed('App\\Services\\Messaging\\InAppNotificationHandler', 'notification_adapter');
            if (config('queue.default') !== 'database' || config('queue.connections.database.retry_after') <= 90 ||
                ! class_exists('App\\Jobs\\Messaging\\DispatchOutbox')) {
                throw new LogicException('Reviewed database queue/dispatcher configuration is required.');
            }
        }
        if ($release) {
            config(['integration.release_admitted' => true, 'integration.p2_enabled' => true]);
        }
    }

    private function selectReleaseAdapters(): void
    {
        foreach (['test_bindings', 'admin_test_bindings', 'photo_test_bindings', 'consent_test_bindings', 'sms_intent_test_bindings'] as $flag) {
            if (config('integration.'.$flag)) {
                throw new LogicException('Release and isolated test selections cannot be mixed.');
            }
        }
        if (getenv('P1_OPERATIONAL_BROWSER') === '1' || getenv('P2_TEST_HTTP') === '1') {
            throw new LogicException('Release cannot use an isolated HTTP harness selection.');
        }
        if (! config('identity.enabled') || config('integration.contract_version') !== 1 ||
            config('integration.event_envelope_version') !== 2 ||
            config('database.default') !== config('integration.connection') ||
            config('database.connections.'.config('integration.connection').'.driver') !== 'mysql' ||
            config('database.connections.'.config('integration.connection').'.timezone') !== '+00:00') {
            throw new LogicException('Release requires actual v1 ports, v2 envelopes and one named UTC MySQL connection.');
        }
        $adapters = [
            'store_adapter' => RelationalStore::class,
            'reference_adapter' => \App\Services\P2\Persistence\ReferenceData::class,
            'audit_adapter' => TypedAuditRecorder::class,
            'outbox_adapter' => TypedOutboxWriter::class,
            'notification_adapter' => InAppHandler::class,
        ];
        foreach ($adapters as $key => $class) {
            if (config('integration.'.$key) !== null && config('integration.'.$key) !== $class) {
                throw new LogicException('Release cannot replace a reviewed adapter with another implementation.');
            }
        }
        foreach ($adapters as $key => $class) {
            config(['integration.'.$key => $class]);
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

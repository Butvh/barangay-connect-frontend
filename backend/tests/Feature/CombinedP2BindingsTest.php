<?php

namespace Tests\Feature;

use App\Providers\IntegrationServiceProvider;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class CombinedP2BindingsTest extends TestCase
{
    use CombinedMysql;

    public function test_prepared_profile_selects_real_classes_without_enabling_original_domains(): void
    {
        $this->combinedMysql();
        config(['integration.test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
        foreach ([
            'App\\Contracts\\P2\\Store' => 'RelationalStore',
            'App\\Contracts\\P2\\ReferenceData' => 'ReferenceData',
            'App\\Contracts\\Events\\AuditRecorder' => 'TypedAuditRecorder',
            'App\\Contracts\\Events\\OutboxWriter' => 'TypedOutboxWriter',
            'App\\Services\\Messaging\\InAppNotificationHandler' => 'InAppHandler',
        ] as $port => $class) {
            $this->assertSame('App\\Services\\P2\\Persistence\\'.$class, get_class($this->app->make($port)));
        }
        $this->assertFalse((bool) config('integration.p2_enabled'));
        $this->assertFalse((bool) config('integration.dispatch_enabled'));
    }
}

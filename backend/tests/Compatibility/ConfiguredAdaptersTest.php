<?php

namespace Tests\Compatibility;

use App\Contracts\Events\OutboxWriter;
use App\Services\Messaging\InAppNotificationHandler;
use Illuminate\Support\Facades\DB;
use Tests\MysqlDbaTestCase;

class ConfiguredAdaptersTest extends MysqlDbaTestCase
{
    public function test_unconfigured_composition_reports_bindings_instead_of_portable_wrapper_names(): void
    {
        if (! interface_exists(OutboxWriter::class)) {
            $this->markTestSkipped('Requires current P1 typed interfaces.');
        }
        $result = (new ConfiguredAdapters($this->app))->resolve();
        $this->assertContains('outbox_adapter_not_configured', $result['diagnostics']);
        $this->assertContains('notification_adapter_not_configured', $result['diagnostics']);
        $this->assertSame([], $result['adapters']);
    }

    public function test_nonportable_implementation_names_are_resolved_from_reviewed_bindings(): void
    {
        if (! interface_exists(OutboxWriter::class)) {
            $this->markTestSkipped('Requires current P1 typed interfaces.');
        }
        require_once __DIR__.'/Fixtures/SqlFixtures.php';
        $this->app->instance(OutboxWriter::class, new Fixtures\InAppOnlyTypedWriter);
        $this->app->instance(InAppNotificationHandler::class, new Fixtures\CompatiblePerRecipientHandler);
        $result = (new ConfiguredAdapters($this->app, testFixtures: true))->resolve();
        $this->assertSame([], $result['diagnostics']);
        $this->assertInstanceOf(Fixtures\InAppOnlyTypedWriter::class, $result['adapters']['outbox']);
    }

    public function test_the_cli_resolver_rejects_test_doubles_as_production_bindings(): void
    {
        if (! interface_exists(OutboxWriter::class)) {
            $this->markTestSkipped('Requires current P1 typed interfaces.');
        }
        require_once __DIR__.'/Fixtures/SqlFixtures.php';
        $result = (new ConfiguredAdapters($this->app))->resolve(['outbox' => Fixtures\CompatibleTypedWriter::class, 'notification' => Fixtures\CompatiblePerRecipientHandler::class]);
        $this->assertContains('outbox_adapter_not_production_source', $result['diagnostics']);
        $this->assertSame([], $result['adapters']);
    }

    public function test_an_explicit_wrong_interface_fails_before_a_fixture_can_be_written(): void
    {
        if (! interface_exists(OutboxWriter::class)) {
            $this->markTestSkipped('Requires current P1 typed interfaces.');
        }
        require_once __DIR__.'/Fixtures/SqlFixtures.php';
        $result = (new ConfiguredAdapters($this->app, testFixtures: true))->resolve(['outbox' => Fixtures\WrongInterface::class, 'notification' => Fixtures\CompatiblePerRecipientHandler::class]);
        $this->assertContains('outbox_adapter_wrong_interface', $result['diagnostics']);
        $this->assertSame(0, DB::table('outbox_events')->count());
    }
}

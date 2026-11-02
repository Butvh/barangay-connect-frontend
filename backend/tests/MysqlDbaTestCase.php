<?php

namespace Tests;

use App\Models\OutboxEvent;
use Database\Seeders\FictionalScenarioSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

abstract class MysqlDbaTestCase extends DbaTestCase
{
    protected function defineEnvironment($app): void
    {
        parent::defineEnvironment($app);
        $app['config']->set('database.default', 'mysql');
        $app['config']->set('database.connections.mysql', [
            'driver' => 'mysql', 'host' => getenv('DB_TEST_HOST') ?: '127.0.0.1', 'port' => getenv('DB_TEST_PORT') ?: '3306',
            'database' => getenv('DB_TEST_DATABASE') ?: '', 'username' => getenv('DB_TEST_USERNAME') ?: '', 'password' => getenv('DB_TEST_PASSWORD') ?: '',
            'charset' => 'utf8mb4', 'collation' => 'utf8mb4_0900_ai_ci', 'prefix' => '', 'strict' => true, 'engine' => 'InnoDB', 'timezone' => '+00:00',
        ]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        if (getenv('DB_TEST_DISPOSABLE') !== '1' || ! str_starts_with((string) getenv('DB_TEST_DATABASE'), 'bc_dba_')) {
            $this->markTestSkipped('Requires an explicitly disposable bc_dba_* genuine MySQL database.');
        }
        $this->assertStringStartsWith('8.4.', DB::selectOne('SELECT VERSION() AS v')->v);
        if (! Schema::hasTable('outbox_events')) {
            $this->migrateUp();
        }
        Schema::disableForeignKeyConstraints();
        try {
            foreach (DB::select('SHOW TABLES') as $row) {
                DB::table(array_values((array) $row)[0])->truncate();
            }
        } finally {
            Schema::enableForeignKeyConstraints();
        }
    }

    protected function migrateUp(): void
    {
        foreach (glob(__DIR__.'/../database/migrations/*.php') as $file) {
            (require $file)->up();
        }
    }

    protected function migrateDown(): void
    {
        foreach (array_reverse(glob(__DIR__.'/../database/migrations/*.php')) as $file) {
            (require $file)->down();
        }
    }

    protected function fixtures(): void
    {
        app(FictionalScenarioSeeder::class)->run();
    }

    protected function event(string $type = 'alert.created.v1', int $scope = 1, int $recipient = 1): OutboxEvent
    {
        $definition = config('messaging.events')[$type];
        $event = OutboxEvent::forceCreate(['event_id' => (string) Str::uuid(), 'version' => 1,
            'type' => $type, 'barangay_id' => $scope, 'resource_type' => $definition['resource'], 'resource_id' => 1,
            'occurred_at' => now(), 'payload' => [], 'template_key' => $definition['template']]);
        DB::table('outbox_recipients')->insert(['outbox_event_id' => $event->id, 'recipient_id' => $recipient, 'barangay_id' => $scope, 'in_app' => true, 'sms' => true]);

        return $event;
    }
}

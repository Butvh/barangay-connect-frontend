<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class MySqlEngineTest extends TestCase
{
    public function test_integration_engine_is_actual_mysql_with_innodb(): void
    {
        if (getenv('MYSQL_INTEGRATION') !== '1') {
            $this->markTestSkipped('Set MYSQL_INTEGRATION=1 with a dedicated MySQL server. No SQLite/MariaDB substitution.');
        }
        $version = DB::selectOne('SELECT VERSION() AS version')->version;
        $this->assertStringNotContainsStringIgnoringCase('mariadb', $version);
        $this->assertMatchesRegularExpression('/^8\./', $version);
        $engines = DB::select('SHOW ENGINES');
        $innodb = array_values(array_filter($engines, fn ($engine) => $engine->Engine === 'InnoDB'));
        $this->assertNotEmpty($innodb);
        $this->assertContains($innodb[0]->Support, ['YES', 'DEFAULT']);
        // This proves the engine only. Domain locking/race tests await DBA schemas.
    }
}

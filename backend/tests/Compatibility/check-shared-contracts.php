<?php

use Illuminate\Contracts\Console\Kernel;
use Tests\Compatibility\ConfiguredAdapters;
use Tests\Compatibility\ContractCheckFailure;
use Tests\Compatibility\SqlContractProbe;

/** Real SQL acceptance gate. No portable-wrapper names, MemoryStore or test-double production binding. */
$autoload = getenv('DBA_TEST_AUTOLOAD') ?: dirname(__DIR__, 2).'/vendor/autoload.php';
if (! is_file($autoload)) {
    fwrite(STDERR, "BLOCKED: reviewed_autoloader_unavailable\n");
    exit(2);
}
require_once $autoload;
$options = getopt('', ['app-base:', 'outbox:', 'handler:', 'sms-intent']);
$base = $options['app-base'] ?? getenv('APP_BASE_PATH') ?: dirname(__DIR__, 2);
if (! is_string($base) || ! is_file($base.'/bootstrap/app.php')) {
    fwrite(STDERR, "BLOCKED: p1_application_unavailable\n");
    exit(2);
}
try {
    $app = require $base.'/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    $probe = new SqlContractProbe($app);
    $probe->assertDisposable();
    $selection = (new ConfiguredAdapters($app))->resolve(array_filter(['outbox' => $options['outbox'] ?? null, 'notification' => $options['handler'] ?? null], fn ($v) => $v !== null));
    foreach ($selection['diagnostics'] as $code) {
        echo 'BLOCKED: '.$code.PHP_EOL;
    }
    if ($selection['diagnostics']) {
        exit(2);
    }
    $report = $probe->run($selection['adapters']['outbox'], $selection['adapters']['notification'], smsIntent: array_key_exists('sms-intent', $options));
    foreach ($selection['selected'] as $role => $class) {
        echo 'SELECTED '.$role.': '.$class.PHP_EOL;
    }
    foreach ($report['checks'] as $check) {
        echo 'PASS: '.$check.PHP_EOL;
    }
    echo "PASS: configured typed SQL/receipt contract; provider calls=0. SQL-domain races remain a separate gate.\n";
} catch (ContractCheckFailure $e) {
    fwrite(STDERR, 'BLOCKED: '.$e->getMessage().PHP_EOL);
    exit(2);
} catch (Throwable) {
    fwrite(STDERR, "BLOCKED: configured_contract_probe_failed (inspect private test diagnostics)\n");
    exit(2);
}

<?php

use App\Providers\P2ServiceProvider;
use Illuminate\Contracts\Console\Kernel;
use Tests\Compatibility\ConfiguredAdapters;
use Tests\Compatibility\SqlContractProbe;

// Run only in a disposable P1 + DBA + P2 composition. No alternate dispatcher/checker.
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$probe = new SqlContractProbe($app);
$probe->assertDisposable();
config(['identity.enabled' => true, 'messaging.sms.enabled' => false, 'messaging.make.enabled' => false]);
require __DIR__.'/bindings.php';
$app->register(P2ServiceProvider::class);
$selection = (new ConfiguredAdapters($app))->resolve();
if ($selection['diagnostics']) {
    throw new RuntimeException(implode(', ', $selection['diagnostics']));
}
$report = $probe->run($selection['adapters']['outbox'], $selection['adapters']['notification']);
foreach ($selection['selected'] as $role => $class) {
    echo 'SELECTED '.$role.': '.$class.PHP_EOL;
}
foreach ($report['checks'] as $check) {
    echo 'PASS '.$check.PHP_EOL;
}
echo 'DBA production-adapter SQL probe passed; provider calls=0; SMS disabled.'.PHP_EOL;

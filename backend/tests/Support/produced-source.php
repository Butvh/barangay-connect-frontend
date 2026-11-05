<?php

/** Execute the unchanged P2 fixture with only confirmed test connection settings. */
$name = getenv('DB_TEST_DATABASE');
if (getenv('DB_TEST_DISPOSABLE') !== '1' || ! preg_match('/^bc_dba_p[12]_[A-Za-z0-9_]+$/D', $name ?: '')) {
    throw new LogicException('confirmed_source_fixture_required');
}
foreach (['HOST', 'PORT', 'DATABASE', 'USERNAME', 'PASSWORD'] as $key) {
    putenv('DB_'.$key.'='.getenv('DB_TEST_'.$key));
    $_ENV['DB_'.$key] = getenv('DB_TEST_'.$key);
}
foreach (['APP_ENV' => 'testing', 'DB_CONNECTION' => 'mysql', 'P2_SOURCE_FIXTURE' => '1', 'IDENTITY_ENABLED' => 'false',
    'P2_TEST_BINDINGS' => 'false', 'SMS_ENABLED' => 'false', 'MAKE_ENABLED' => 'false', 'OUTBOX_DISPATCH_ENABLED' => 'false',
    'APP_BASE_PATH' => dirname(__DIR__, 2)] as $key => $value) {
    putenv($key.'='.$value);
    $_ENV[$key] = $value;
}
try {
    require dirname(__DIR__).'/P2/producer-fixture.php';
} catch (Throwable $error) {
    fwrite(STDERR, 'Actual source fixture failed: '.$error->getMessage().PHP_EOL);
    exit(1);
}

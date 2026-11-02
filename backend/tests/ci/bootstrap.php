<?php

$autoload = getenv('DBA_TEST_AUTOLOAD');
if (! $autoload || ! is_file($autoload)) {
    throw new RuntimeException('Set DBA_TEST_AUTOLOAD to the absolute test-harness autoloader.');
}
require $autoload;
if (getenv('DB_TEST_DISPOSABLE') !== '1' || ! str_starts_with((string) getenv('DB_TEST_DATABASE'), 'bc_dba_')) {
    throw new RuntimeException('Refusing database tests without explicit disposable bc_dba_* target.');
}

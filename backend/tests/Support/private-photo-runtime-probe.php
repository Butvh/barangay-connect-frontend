<?php

declare(strict_types=1);

use App\Services\Photos\PhotoInspector;
use App\Support\ApiProblem;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;

function photoProbeRuntime(): array
{
    $scan = php_ini_scanned_files();
    $ini = php_ini_loaded_file();

    return [
        'version' => PHP_VERSION,
        'sapi' => PHP_SAPI,
        'executable_sha256' => hash_file('sha256', PHP_BINARY),
        'loaded_ini' => $ini ? basename($ini) : null,
        'scanned_ini' => $scan ? array_map('basename', preg_split('/,\s*/', trim($scan))) : [],
        'scan_directory_set' => getenv('PHP_INI_SCAN_DIR') !== false,
        'gd' => extension_loaded('gd'),
        'windows_system_root_present' => PHP_OS_FAMILY === 'Windows' ? (bool) getenv('SystemRoot') : null,
    ];
}

if (PHP_SAPI === 'cli' && ($argv[1] ?? null) === '--runtime') {
    echo json_encode(photoProbeRuntime(), JSON_THROW_ON_ERROR);
    exit;
}

if (PHP_SAPI !== 'cli-server' || ($_SERVER['REMOTE_ADDR'] ?? null) !== '127.0.0.1' ||
    ($_SERVER['REQUEST_METHOD'] ?? null) !== 'GET' || ($_SERVER['REQUEST_URI'] ?? null) !== '/probe' ||
    getenv('P1_PRIVATE_PHOTO_PROBE') !== '1' || getenv('DB_TEST_DISPOSABLE') !== '1' ||
    getenv('DB_HOST') !== '127.0.0.1' || ! preg_match('/^bc_dba_p1_[a-z0-9_]+$/D', (string) getenv('DB_DATABASE')) ||
    getenv('DB_DATABASE') !== getenv('DB_TEST_DATABASE')) {
    http_response_code(404);
    exit;
}

function photoProbeProcess(array $command, ?string $input = null): array
{
    $process = new Process($command);
    try {
        $process->setTimeout(15)->setInput($input)->run();
    } catch (ProcessTimedOutException) {
        return [['exit' => null, 'stderr' => 'timeout'], ''];
    }
    $stderr = $process->getErrorOutput();

    return [[
        'exit' => $process->getExitCode(),
        'stderr' => match (true) {
            $stderr === '' => 'none',
            preg_match('/PHP Startup|unable to load dynamic library/i', $stderr) === 1 => 'php-startup',
            default => 'other',
        },
    ], $process->getOutput()];
}

header('Content-Type: application/json');
try {
    require dirname(__DIR__, 2).'/vendor/autoload.php';
    $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    $connection = DB::connection('mysql');
    if (! $app->environment('testing') || $connection->getDatabaseName() !== getenv('DB_TEST_DATABASE') ||
        $connection->getConfig('host') !== '127.0.0.1') {
        throw new LogicException('Private runtime profile required.');
    }
    $server = $connection->selectOne('SELECT VERSION() AS version, @@session.time_zone AS timezone');
    $ini = php_ini_loaded_file();
    $php = [PHP_BINARY, ...($ini ? ['-c', $ini] : []), '-d', 'memory_limit=256M', '-d', 'max_execution_time=10'];
    [$childExit, $childJson] = photoProbeProcess([...$php, __FILE__, '--runtime']);
    $child = json_decode($childJson, true);
    // Generated 32 by 24 PNG fixture, with no resident or upload data.
    $input = base64_decode('iVBORw0KGgoAAAANSUhEUgAAACAAAAAYCAIAAAAUMWhjAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAGElEQVRIie3BAQEAAACAkP6v7ggKAICqAQkYAAHO7iU+AAAAAElFTkSuQmCC', true);
    [$normalize, $output] = photoProbeProcess([...$php, dirname(__DIR__, 2).'/app/Services/Photos/normalize.php'], $input);
    $shape = $output === '' ? false : @getimagesizefromstring($output);
    try {
        $inspection = ['bytes' => (new PhotoInspector)->inspect($input)['bytes']];
    } catch (ApiProblem $error) {
        $inspection = ['status' => $error->status, 'code' => $error->errorCode];
    }
    $parent = photoProbeRuntime();
    $shape = $shape ? ['width' => $shape[0], 'height' => $shape[1], 'mime' => $shape['mime']] : null;
    $ok = $parent['gd'] && ($child['gd'] ?? false) && $child['executable_sha256'] === $parent['executable_sha256'] &&
        $childExit['exit'] === 0 && $normalize['exit'] === 0 && ($inspection['bytes'] ?? 0) > 0 &&
        $shape === ['width' => 32, 'height' => 24, 'mime' => 'image/png'] &&
        str_starts_with($server->version, '8.4.') && $server->timezone === '+00:00';
    if (! $ok) {
        http_response_code(422);
    }
    echo json_encode(['passed' => $ok, 'web' => $parent, 'child' => $child, 'child_start' => $childExit,
        'normalization' => $normalize + ['bytes' => strlen($output), 'shape' => $shape], 'inspection' => $inspection,
        'database' => ['version' => $server->version, 'timezone' => $server->timezone]], JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
} catch (Throwable) {
    http_response_code(503);
    echo '{"passed":false,"error":"Check the private PHP and disposable Laravel database configuration."}';
}

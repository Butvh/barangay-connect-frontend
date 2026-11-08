<?php

use App\Models\User;
use App\Models\Verification;
use Illuminate\Support\Facades\DB;

/** Real socket HTTP/cookies, actual DBA User/provider, P1 session/CSRF, P2 services. */
$httpUser = saveModel(User::class, ['barangay_id' => $scope->id, 'household_id' => $home->id, 'full_name' => 'HTTP fixture', 'email' => 'http-fixture@example.test', 'password' => 'Fixture123', 'account_status' => 'Active', 'is_resident' => true]);
saveModel(Verification::class, ['resident_id' => $httpUser->id, 'barangay_id' => $scope->id, 'review_status' => 'Approved']);
$listener = stream_socket_server('tcp://127.0.0.1:0');
verify(is_resource($listener), 'Unable to reserve a loopback test port.');
$port = (int) substr(strrchr(stream_socket_get_name($listener, false), ':'), 1);
fclose($listener);
$log = tempnam(sys_get_temp_dir(), 'p2-http-');
putenv('P2_TEST_HTTP=1');
$process = proc_open([PHP_BINARY, '-S', '127.0.0.1:'.$port, '-t', dirname(__DIR__, 2).'/public', __DIR__.'/http-router.php'], [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes);
verify(is_resource($process), 'HTTP server did not start.');
fclose($pipes[0]);
try {
    $ready = false;
    for ($attempt = 0; $attempt < 100; $attempt++) {
        $socket = @fsockopen('127.0.0.1', $port, $error, $message, 0.05);
        if ($socket) {
            fclose($socket);
            $ready = true;
            break;
        }
        usleep(50000);
    }
    verify($ready, 'HTTP server not ready: '.file_get_contents($log));
    $call = function (array &$cookies, string $path, string $method = 'GET', ?array $body = null, array $headers = []) use ($port): array {
        $headers = ['Accept: application/json', 'Content-Type: application/json', ...$headers];
        if ($cookies) {
            $headers[] = 'Cookie: '.implode('; ', array_map(fn ($key, $value) => $key.'='.$value, array_keys($cookies), $cookies));
        }
        $context = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body === null ? '' : json_encode($body, JSON_THROW_ON_ERROR), 'ignore_errors' => true, 'timeout' => 10]]);
        $text = file_get_contents('http://127.0.0.1:'.$port.'/api/v1/'.$path, false, $context);
        $responseHeaders = http_get_last_response_headers();
        foreach ($responseHeaders as $line) {
            if (preg_match('/^Set-Cookie: ([^=]+)=([^;]*)/i', $line, $match)) {
                $cookies[$match[1]] = $match[2];
            }
        }
        preg_match('/ (\d{3}) /', $responseHeaders[0], $match);

        return [(int) $match[1], json_decode($text, true)];
    };
    $login = function (string $email) use ($call): array {
        $cookies = [];
        [$status, $response] = $call($cookies, 'auth/csrf');
        verify($status === 200, 'CSRF bootstrap failed.');
        [$status, $response] = $call($cookies, 'auth/login', 'POST', ['email' => $email, 'password' => 'Fixture123', 'portal' => 'resident'], ['X-CSRF-TOKEN: '.$response['data']['csrf_token']]);
        verify($status === 200, 'Actual DB login failed: '.$status);
        [$status, $response] = $call($cookies, 'auth/csrf');

        return [$cookies, $response['data']['csrf_token']];
    };
    caseTest('Actual P1 HTTP login, CSRF, retry-safe P2 SOS and session generation revocation', function () use ($call, $login, $httpUser) {
        $guest = [];
        verify($call($guest, 'alerts')[0] === 401, 'Guest read succeeded.');
        verify($call($guest, 'alerts', 'POST', [])[0] === 419, 'Real HTTP CSRF was bypassed.');
        [$cookies, $csrf] = $login($httpUser->email);
        $headers = ['X-CSRF-TOKEN: '.$csrf, 'Idempotency-Key: actual-http-intent', 'X-BC-Identity: '.$httpUser->id.':'.$httpUser->barangay_id.':resident'];
        [$status, $first] = $call($cookies, 'alerts', 'POST', ['alert_type' => 'Other'], $headers);
        verify($status === 200, 'Authenticated SOS failed: '.$status);
        [$status, $retry] = $call($cookies, 'alerts', 'POST', ['alert_type' => 'Other'], $headers);
        verify($status === 200 && $retry['data']['id'] === $first['data']['id'] && DB::table('emergency_alerts')->where('resident_id', $httpUser->id)->count() === 1, 'HTTP retry duplicated SOS.');
        [$status, $rows] = $call($cookies, 'alerts');
        verify($status === 200 && $rows['meta']['complete'] === true && count($rows['data']) === 1, 'Authenticated complete scope failed.');
        verify($call($cookies, 'revisions/alerts')[0] === 200, 'Authorized refresh unavailable.');
        $httpUser->forceFill(['auth_version' => $httpUser->fresh()->auth_version + 1])->save();
        verify($call($cookies, 'me')[0] === 401, 'Changed generation did not revoke session.');
    });
    require __DIR__.'/http-ui-cases.php';
} finally {
    proc_terminate($process);
    proc_close($process);
    putenv('P2_TEST_HTTP');
}

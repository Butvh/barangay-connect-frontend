<?php

namespace Tests\Feature;

use App\Jobs\DeliverLocalRecoveryCode;
use App\Models\CapacityGuard;
use App\Providers\IntegrationServiceProvider;
use App\Services\Identity\PasswordRecovery;
use App\Support\ApiProblem;
use Illuminate\Contracts\Encryption\Encrypter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\Process\Process;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class CombinedPasswordRecoveryTest extends TestCase
{
    use CombinedMysql;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        config(['integration.test_bindings' => true, 'integration.admin_test_bindings' => true, 'identity.local_recovery_mail' => true]);
        (new IntegrationServiceProvider($this->app))->register();
    }

    private function code(string $id): string
    {
        // Test-only access to the encrypted local job, equivalent to reading the
        // fictional SMTP inbox. No code is returned by a production endpoint.
        foreach (DB::table('jobs')->where('queue', 'p1-recovery')->orderByDesc('id')->get() as $row) {
            $payload = json_decode($row->payload, true, flags: JSON_THROW_ON_ERROR);
            $job = unserialize(app(Encrypter::class)->decrypt($payload['data']['command']), ['allowed_classes' => [DeliverLocalRecoveryCode::class]]);
            if ((new \ReflectionProperty($job, 'challenge'))->getValue($job) === $id) {
                return (new \ReflectionProperty($job, 'code'))->getValue($job);
            }
        }
        $this->fail('Encrypted fictional recovery job was not queued.');
    }

    private function job(string $id): DeliverLocalRecoveryCode
    {
        foreach (DB::table('jobs')->where('queue', 'p1-recovery')->orderByDesc('id')->get() as $row) {
            $payload = json_decode($row->payload, true, flags: JSON_THROW_ON_ERROR);
            $job = unserialize(app(Encrypter::class)->decrypt($payload['data']['command']), ['allowed_classes' => [DeliverLocalRecoveryCode::class]]);
            if ((new \ReflectionProperty($job, 'challenge'))->getValue($job) === $id) {
                return $job;
            }
        }
        $this->fail('Encrypted fictional recovery job was not queued.');
    }

    public function test_known_unknown_and_wrong_portal_requests_are_neutral_and_queue_only_encrypted_jobs(): void
    {
        $user = $this->sourceUser();
        $service = app(PasswordRecovery::class);
        $known = $service->request(['email' => $user->email, 'portal' => 'resident']);
        $unknown = $service->request(['email' => bin2hex(random_bytes(8)).'@example.invalid', 'portal' => 'resident']);
        $wrong = $service->request(['email' => $user->email, 'portal' => 'official']);
        foreach ([$known, $unknown, $wrong] as $result) {
            $this->assertSame(['accepted', 'challenge_id', 'expires_in', 'retry_after'], array_keys($result));
            $this->assertTrue($result['accepted']);
            $this->assertSame(600, $result['expires_in']);
            $this->assertSame(60, $result['retry_after']);
        }
        $this->assertNull(DB::table('password_recovery_challenges')->where('id', $unknown['challenge_id'])->value('user_id'));
        $this->assertNull(DB::table('password_recovery_challenges')->where('id', $wrong['challenge_id'])->value('user_id'));
        $this->assertNull(DB::table('password_recovery_challenges')->where('id', $known['challenge_id'])->value('superseded_at'));
        $payload = json_decode(DB::table('jobs')->where('queue', 'p1-recovery')->orderByDesc('id')->value('payload'), true);
        $this->assertFalse(str_contains($payload['data']['command'], 'DeliverLocalRecoveryCode'));
        $this->assertFalse(str_contains(json_encode($payload), $user->email));
        $this->assertMatchesRegularExpression('/^[0-9]{6}$/D', $this->code($known['challenge_id']));
    }

    public function test_failed_attempts_are_committed_and_five_failures_invalidate_even_the_correct_code(): void
    {
        $user = $this->sourceUser();
        $service = app(PasswordRecovery::class);
        $request = $service->request(['email' => $user->email, 'portal' => 'resident']);
        $correct = $this->code($request['challenge_id']);
        $wrong = $correct === '000000' ? '999999' : '000000';
        for ($i = 1; $i <= 5; $i++) {
            try {
                $service->verify(['challenge_id' => $request['challenge_id'], 'code' => $wrong]);
                $this->fail('Wrong code must be rejected.');
            } catch (ApiProblem $error) {
                $this->assertSame('INVALID_CODE', $error->errorCode);
            }
            $this->assertSame($i, DB::table('password_recovery_challenges')->where('id', $request['challenge_id'])->value('failed_attempts'));
        }
        $this->expectException(ApiProblem::class);
        $service->verify(['challenge_id' => $request['challenge_id'], 'code' => $correct]);
    }

    public function test_resend_cooldown_expiry_and_one_use_code_are_enforced_from_server_time(): void
    {
        $user = $this->sourceUser();
        $service = app(PasswordRecovery::class);
        $first = $service->request(['email' => $user->email, 'portal' => 'resident']);
        try {
            $service->request(['email' => $user->email, 'portal' => 'resident']);
            $this->fail('Resend cannot bypass the cooldown.');
        } catch (ApiProblem $error) {
            $this->assertSame('RATE_LIMIT', $error->errorCode);
        }
        $this->travel(61)->seconds();
        $second = $service->request(['email' => $user->email, 'portal' => 'resident']);
        $this->assertNotSame($first['challenge_id'], $second['challenge_id']);
        $this->assertNotNull(DB::table('password_recovery_challenges')->where('id', $first['challenge_id'])->value('superseded_at'));
        $verified = $service->verify(['challenge_id' => $second['challenge_id'], 'code' => $this->code($second['challenge_id'])]);
        $this->assertTrue($verified['verified']);
        $this->assertSame(64, strlen($verified['reset_authorization']));
        $this->expectException(ApiProblem::class);
        $service->verify(['challenge_id' => $second['challenge_id'], 'code' => $this->code($second['challenge_id'])]);
    }

    public function test_actual_reset_consumes_authorization_revokes_generation_and_never_signs_in(): void
    {
        $user = $this->sourceUser();
        $service = app(PasswordRecovery::class);
        $request = $service->request(['email' => $user->email, 'portal' => 'resident']);
        $verified = $service->verify(['challenge_id' => $request['challenge_id'], 'code' => $this->code($request['challenge_id'])]);
        $result = $service->reset(['reset_authorization' => $verified['reset_authorization'], 'password' => ' NewResetPassword123 ', 'password_confirmation' => ' NewResetPassword123 ']);
        $this->assertSame(['password_reset' => true], $result);
        $this->assertTrue(Hash::check(' NewResetPassword123 ', $user->fresh()->password));
        $this->assertSame(1, $user->fresh()->auth_version);
        $this->assertNotNull(DB::table('password_recovery_challenges')->where('id', $request['challenge_id'])->value('consumed_at'));
        $this->assertGuest();
        $this->expectException(ApiProblem::class);
        $service->reset(['reset_authorization' => $verified['reset_authorization'], 'password' => 'AnotherPassword123', 'password_confirmation' => 'AnotherPassword123']);
    }

    public function test_independent_workers_cannot_verify_one_code_twice_after_waiting_on_the_original_person_guard(): void
    {
        $user = $this->sourceUser();
        $request = app(PasswordRecovery::class)->request(['email' => $user->email, 'portal' => 'resident']);
        $code = $this->code($request['challenge_id']);
        $workers = [];
        $db = DB::connection('mysql');
        $db->beginTransaction();
        try {
            CapacityGuard::lockPeople([$user->id]);
            CapacityGuard::lockRows('users', [$user->id]);
            for ($i = 0; $i < 2; $i++) {
                $process = new Process([PHP_BINARY, base_path('tests/Support/administration-worker.php')], base_path(), ['APP_KEY' => config('app.key')]);
                $process->setInput(json_encode(['challenge_id' => $request['challenge_id'], 'code' => $code], JSON_THROW_ON_ERROR))->setTimeout(20);
                $process->start();
                $this->assertTrue($process->waitUntil(fn () => str_contains($process->getOutput(), 'ready:')));
                $workers[] = $process;
            }
            $connections = array_map(function ($worker) {
                preg_match('/ready:([0-9]+)/', $worker->getOutput(), $match);

                return (int) $match[1];
            }, $workers);
            $deadline = microtime(true) + 5;
            do {
                $waiting = $db->table('performance_schema.data_lock_waits as w')->join('performance_schema.threads as t', 't.THREAD_ID', '=', 'w.REQUESTING_THREAD_ID')
                    ->whereIn('t.PROCESSLIST_ID', $connections)->count();
                if ($waiting >= 2) {
                    break;
                }
                usleep(10000);
            } while (microtime(true) < $deadline);
            $this->assertSame(2, $waiting, 'Both actual commands must be observed waiting on the held source guard.');
        } finally {
            $db->rollBack();
        }
        try {
            $results = [];
            foreach ($workers as $worker) {
                $this->assertSame(0, $worker->wait());
                $lines = explode("\n", trim($worker->getOutput()));
                $results[] = json_decode(end($lines), true, flags: JSON_THROW_ON_ERROR);
            }
            $this->assertSame(1, count(array_filter($results, fn ($r) => $r['verified'])));
            $this->assertSame(1, count(array_filter($results, fn ($r) => ($r['code'] ?? null) === 'INVALID_CODE')));
            $this->assertNotNull(DB::table('password_recovery_challenges')->where('id', $request['challenge_id'])->value('verified_at'));
        } finally {
            foreach ($workers as $worker) {
                if ($worker->isRunning()) {
                    $worker->stop();
                }
            }
        }
    }

    public function test_actual_encrypted_job_delivers_to_a_private_loopback_smtp_sink_without_real_mail(): void
    {
        $user = $this->sourceUser();
        $service = app(PasswordRecovery::class);
        $request = $service->request(['email' => $user->email, 'portal' => 'resident']);
        $inbox = storage_path('app/private/recovery-mail-test-'.bin2hex(random_bytes(8)).'.eml');
        $sink = new Process(['node', base_path('tests/Support/local-smtp-sink.mjs'), $inbox], base_path());
        $sink->setTimeout(20)->start();
        try {
            $this->assertTrue($sink->waitUntil(fn () => str_contains($sink->getOutput(), '"port"')));
            $port = json_decode(trim($sink->getOutput()), true, flags: JSON_THROW_ON_ERROR)['port'];
            config(['mail.mailers.p1-local-recovery.port' => $port]);
            $this->job($request['challenge_id'])->handle($service);
            $this->assertFileExists($inbox);
            $message = quoted_printable_decode(file_get_contents($inbox));
            // Do not print the fictional inbox, code or address even on failure.
            $this->assertTrue(str_contains($message, $this->code($request['challenge_id'])));
            $this->assertTrue(str_contains($message, $user->email));
            $this->assertTrue(str_contains($message, 'Barangay Connect account recovery'));
            $this->assertTrue(str_contains($message, '10 minutes after the request'));
        } finally {
            $sink->stop();
        }
    }
}

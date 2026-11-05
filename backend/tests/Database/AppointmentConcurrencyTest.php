<?php

namespace Tests\Database;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\MysqlDbaTestCase;

class AppointmentConcurrencyTest extends MysqlDbaTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->fixtures();
    }

    private function race(array $actions): array
    {
        $barrier = sys_get_temp_dir().'/bc-race-'.bin2hex(random_bytes(8));
        mkdir($barrier);
        $autoload = getenv('DBA_TEST_AUTOLOAD') ?: realpath(__DIR__.'/../../vendor/autoload.php');
        $this->assertNotFalse($autoload, 'Set DBA_TEST_AUTOLOAD to the verification Composer autoloader.');
        $workers = [];
        try {
            foreach ($actions as $nonce => [$mode, $user, $resource]) {
                $p = new Process([PHP_BINARY, __DIR__.'/../Support/race-worker.php', $autoload, $mode, $barrier, (string) $nonce, (string) $user, (string) $resource]);
                $p->setTimeout(20);
                $p->start();
                $workers[] = $p;
            }
            $deadline = microtime(true) + 10;
            while (count(glob($barrier.'/ready-*')) !== count($workers) && microtime(true) < $deadline) {
                usleep(10000);
            }
            $this->assertCount(count($workers), glob($barrier.'/ready-*'), 'Workers must overlap at the barrier.');
            touch($barrier.'/go');
            $results = [];
            foreach ($workers as $p) {
                $p->wait();
                $this->assertSame(0, $p->getExitCode(), $p->getErrorOutput());
                $results[] = trim($p->getOutput());
            }
            sort($results);

            return $results;
        } finally {
            foreach ($workers as $p) {
                if ($p->isRunning()) {
                    $p->stop();
                }
            }
            foreach (glob($barrier.'/*') as $f) {
                unlink($f);
            } rmdir($barrier);
        }
    }

    public function test_simultaneous_last_staffing_slot_and_first_guard_creation(): void
    {
        DB::table('personnel_appointments')->where('user_id', 10)->update(['role' => null, 'status' => 'Unassigned']);
        $this->assertSame(['appointed', 'capacity'], $this->race([['staffing', 11, 0], ['staffing', 12, 0]]));
        $this->assertSame(3, DB::table('personnel_appointments')->where('barangay_id', 1)->where('role', 'secretary')->count());
        $this->assertSame(1, DB::table('capacity_guards')->where('scope_type', 'barangay')->where('scope_id', 1)->count());
    }

    public function test_last_dispatch_slot_across_different_incidents(): void
    {
        DB::table('alert_assignments')->where('id', 1)->update(['status' => 'completed']);
        $this->assertSame(['assigned', 'capacity'], $this->race([['dispatch', 3, 3], ['dispatch', 3, 4]]));
        $this->assertSame(2, DB::table('alert_assignments')->where('user_id', 3)->where('status', 'active')->count());
    }

    public function test_dispatch_and_removal_share_the_person_guard(): void
    {
        DB::table('personnel_appointments')->where('user_id', 7)->update(['status' => 'Active']);
        $results = $this->race([['dispatch', 7, 3], ['remove', 7, 0]]);
        $this->assertTrue(in_array($results, [['assigned', 'busy'], ['removed', 'unavailable']], true));
        if (DB::table('personnel_appointments')->where('user_id', 7)->value('role') === null) {
            $this->assertSame(0, DB::table('alert_assignments')->where('user_id', 7)->where('status', 'active')->count());
        }
    }

    public function test_transfer_and_completion_cannot_end_the_same_responsibility_twice(): void
    {
        DB::table('personnel_appointments')->where('user_id', 7)->update(['status' => 'Active']);
        $results = $this->race([['transfer', 7, 1], ['complete', 3, 1]]);
        $this->assertTrue(in_array($results, [['completed', 'stale'], ['stale', 'transferred']], true));
        $this->assertLessThanOrEqual(1, DB::table('alert_assignments')->where('alert_id', 1)->where('role', 'responder')->where('status', 'active')->count());
    }

    public function test_review_and_resubmit_require_the_exact_revision(): void
    {
        $results = $this->race([['review', 5, 1], ['resubmit', 5, 1]]);
        $this->assertTrue(in_array($results, [['approved', 'stale'], ['resubmitted', 'stale']], true));
        $this->assertSame(1, DB::table('verifications')->where('id', 1)->value('revision'));
    }

    public function test_deactivation_and_destination_snapshot_are_serialized(): void
    {
        $results = $this->race([['deactivate', 0, 1], ['destination', 0, 1]]);
        $this->assertTrue(in_array($results, [['deactivated', 'inactive'], ['deactivated', 'used']], true));
        $this->assertSame(0, DB::table('facilities')->where('id', 1)->value('active'));
        if (in_array('used', $results, true)) {
            $this->assertTrue(json_decode(DB::table('rescues')->orderByDesc('id')->value('destination_snapshot'), true)['active_at_use']);
        }
    }

    public function test_repeated_sos_reuses_one_active_record(): void
    {
        $this->assertSame(['created', 'existing'], $this->race([['sos', 20, 0], ['sos', 20, 0]]));
        $this->assertSame(1, DB::table('emergency_alerts')->where('resident_id', 20)->where('status', '<>', 'Resolved')->count());
    }

    public function test_reset_consumption_and_password_update_are_one_use(): void
    {
        DB::table('password_recovery_challenges')->insert(['id' => (string) Str::uuid(), 'user_id' => 5,
            'email_digest' => str_repeat('a', 64), 'code_digest' => str_repeat('b', 64), 'expires_at' => now()->addMinutes(10),
            'resend_available_at' => now()->addMinute(), 'created_at' => now(), 'updated_at' => now()]);
        $this->assertSame(['consumed', 'reset'], $this->race([['reset', 5, 0], ['reset', 5, 0]]));
    }
}

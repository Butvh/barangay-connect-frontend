<?php

use App\Models\CapacityGuard;
use Illuminate\Database\Capsule\Manager;
use Illuminate\Support\Facades\Facade;

// Independent committed connection. This exercises the shared protocol, not P1/P2 services.
require $argv[1];
$capsule = new Manager;
$capsule->addConnection(['driver' => 'mysql', 'host' => getenv('DB_TEST_HOST'), 'port' => getenv('DB_TEST_PORT'),
    'database' => getenv('DB_TEST_DATABASE'), 'username' => getenv('DB_TEST_USERNAME'), 'password' => getenv('DB_TEST_PASSWORD'),
    'charset' => 'utf8mb4', 'collation' => 'utf8mb4_0900_ai_ci', 'prefix' => '', 'strict' => true]);
$capsule->setAsGlobal();
$capsule->bootEloquent();
$capsule->getContainer()->instance('db', $capsule->getDatabaseManager());
Facade::setFacadeApplication($capsule->getContainer());
$db = $capsule->getConnection();
[$mode, $barrier, $nonce, $user, $resource] = array_slice($argv, 2);
$user = (int) $user;
$resource = (int) $resource;
touch($barrier.'/ready-'.$nonce);
$deadline = microtime(true) + 15;
while (! is_file($barrier.'/go')) {
    if (microtime(true) > $deadline) {
        exit(3);
    } usleep(10000);
}
try {
    $result = $db->transaction(function () use ($db, $mode, $user, $resource) {
        $at = gmdate('Y-m-d H:i:s');
        if ($mode === 'staffing') {
            CapacityGuard::lockScope('barangay', 1, 'staffing');
            CapacityGuard::lockPeople([$user]);
            if ($db->table('personnel_appointments')->where('barangay_id', 1)->where('role', 'secretary')->count() >= 3) {
                return 'capacity';
            }
            usleep(50000);
            $db->table('personnel_appointments')->insert(['user_id' => $user, 'barangay_id' => 1, 'role' => 'secretary', 'source' => 'external', 'status' => 'Active', 'created_at' => $at, 'updated_at' => $at]);

            return 'appointed';
        }
        if (in_array($mode, ['dispatch', 'remove', 'transfer', 'complete'], true)) {
            if ($mode === 'remove') {
                CapacityGuard::lockScope('barangay', 1, 'staffing');
            }
            CapacityGuard::lockPeople(in_array($mode, ['transfer', 'complete'], true) ? [3, 7] : [$user]);
            if ($mode === 'remove') {
                if ($db->table('alert_assignments')->where('user_id', $user)->where('status', 'active')->exists()) {
                    return 'busy';
                }
                $db->table('personnel_appointments')->where('user_id', $user)->update(['role' => null, 'status' => 'Unassigned']);

                return 'removed';
            }
            $db->table('emergency_alerts')->where('id', $resource)->lockForUpdate()->first();
            if ($mode === 'complete') {
                $count = $db->table('alert_assignments')->where('alert_id', $resource)->where('user_id', 3)->where('status', 'active')->update(['status' => 'completed', 'ended_at' => $at]);

                return $count ? 'completed' : 'stale';
            }
            if ($mode === 'transfer') {
                $old = $db->table('alert_assignments')->where('alert_id', $resource)->where('user_id', 3)->where('status', 'active')->lockForUpdate()->first();
                if (! $old) {
                    return 'stale';
                }
                $db->table('alert_assignments')->where('id', $old->id)->update(['status' => 'reassigned', 'ended_at' => $at]);
                $user = 7;
            }
            $appointment = $db->table('personnel_appointments')->where('user_id', $user)->first();
            if (! $appointment || $appointment->role !== 'responder' || $appointment->status !== 'Active') {
                return 'unavailable';
            }
            if ($db->table('alert_assignments')->where('user_id', $user)->where('role', 'responder')->where('status', 'active')->count() >= 2) {
                return 'capacity';
            }
            usleep(50000);
            $db->table('alert_assignments')->insert(['alert_id' => $resource, 'barangay_id' => 1, 'user_id' => $user, 'role' => 'responder', 'assigned_by' => 1, 'assigned_at' => $at, 'status' => 'active', 'created_at' => $at, 'updated_at' => $at]);

            return $mode === 'transfer' ? 'transferred' : 'assigned';
        }
        if (in_array($mode, ['review', 'resubmit'], true)) {
            CapacityGuard::lockPeople([$user], 'verification');
            $application = $db->table('verifications')->where('id', $resource)->lockForUpdate()->first();
            if ($application->revision !== 0 || $application->review_status !== 'Pending') {
                return 'stale';
            }
            if ($mode === 'review') {
                $db->table('verifications')->where('id', $resource)->update(['review_status' => 'Approved', 'revision' => 1]);

                return 'approved';
            }
            $submission = $db->table('verification_submissions')->insertGetId(['verification_id' => $resource, 'barangay_id' => 1, 'revision' => 2, 'submitted_at' => $at]);
            $db->table('verifications')->where('id', $resource)->update(['current_submission_id' => $submission, 'revision' => 1]);

            return 'resubmitted';
        }
        if (in_array($mode, ['deactivate', 'destination'], true)) {
            // Fixture models the common facility lock; domain service must also take person/incident locks first.
            $facility = $db->table('facilities')->where('id', $resource)->lockForUpdate()->first();
            if ($mode === 'deactivate') {
                $db->table('facilities')->where('id', $resource)->update(['active' => false]);

                return 'deactivated';
            }
            if (! $facility->active) {
                return 'inactive';
            }
            $assignment = $db->table('alert_assignments')->where('role', 'rescuer')->where('barangay_id', 1)->first();
            $db->table('rescues')->insert(['alert_id' => $assignment->alert_id, 'assignment_id' => $assignment->id, 'rescuer_id' => $assignment->user_id, 'facility_id' => $resource,
                'destination_snapshot' => json_encode(['name' => $facility->name, 'active_at_use' => true]), 'rescue_status' => 'In progress', 'rescued_at' => $at, 'created_at' => $at, 'updated_at' => $at]);

            return 'used';
        }
        if ($mode === 'sos') {
            CapacityGuard::lockPeople([$user], 'sos');
            $existing = $db->table('emergency_alerts')->where('resident_id', $user)->where('status', '<>', 'Resolved')->first();
            if ($existing) {
                return 'existing';
            }
            $db->table('emergency_alerts')->insert(['resident_id' => $user, 'barangay_id' => 1, 'household_id' => 1, 'alert_type' => 'Other', 'location_label' => 'Fictional district', 'status' => 'Pending', 'reported_at' => $at, 'created_at' => $at, 'updated_at' => $at]);

            return 'created';
        }
        if ($mode === 'reset') {
            $challenge = $db->table('password_recovery_challenges')->where('user_id', $user)->lockForUpdate()->first();
            if ($challenge->consumed_at !== null) {
                return 'consumed';
            }
            $db->table('password_recovery_challenges')->where('id', $challenge->id)->update(['consumed_at' => $at]);
            $db->table('users')->where('id', $user)->update(['password' => password_hash(bin2hex(random_bytes(24)), PASSWORD_BCRYPT, ['cost' => 4])]);

            return 'reset';
        }
        throw new LogicException('Unknown fixture mode');
    }, 3);
    echo $result;
} catch (Throwable $e) {
    fwrite(STDERR, get_class($e).': protocol fixture failed');
    exit(2);
}

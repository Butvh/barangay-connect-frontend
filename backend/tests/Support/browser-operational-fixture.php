<?php

use App\Models\Barangay;
use App\Models\CapacityGuard;
use App\Models\Facility;
use App\Models\Household;
use App\Models\OutboxEvent;
use App\Models\PersonnelAppointment;
use App\Models\User;
use App\Models\Verification;
use App\Providers\IntegrationServiceProvider;
use App\Services\Messaging\OutboxDispatcher;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$db = DB::connection('mysql');
if (! $app->environment('testing') || getenv('P1_COMBINED_TESTS') !== '1' || getenv('DB_TEST_DISPOSABLE') !== '1' ||
    ! str_starts_with($db->getDatabaseName(), 'bc_dba_p1_') || $db->getDatabaseName() !== getenv('DB_TEST_DATABASE') ||
    ! str_starts_with($db->selectOne('SELECT VERSION() AS v')->v, '8.4.')) {
    throw new LogicException('Operational browser fixtures require confirmed disposable MySQL8.4.');
}
$mode = $argv[1] ?? 'create';
if (in_array($mode, ['revoke', 'inactive'], true)) {
    $id = filter_var($argv[2] ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $db->transaction(function () use ($db, $id, $mode): void {
        CapacityGuard::lockPeople([$id]);
        $user = $db->table('users')->where('id', $id)->where('email', 'like', 'operational-qa-%@example.invalid')->lockForUpdate()->first();
        if (! $user) {
            throw new LogicException('Not an owned operational fixture.');
        }
        $db->table('users')->where('id', $id)->update(['auth_version' => $user->auth_version + 1] + ($mode === 'inactive' ? ['account_status' => 'Inactive'] : []));
    });
    exit;
}
if (in_array($mode, ['inspect', 'deliver'], true)) {
    $id = filter_var($argv[2] ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $alert = $db->table('emergency_alerts')->join('users', 'users.id', '=', 'emergency_alerts.resident_id')
        ->where('emergency_alerts.id', $id)->where('users.email', 'like', 'operational-qa-%@example.invalid')->first(['emergency_alerts.*']);
    if (! $alert) {
        throw new LogicException('Not an owned operational incident.');
    }
    if ($mode === 'deliver') {
        config(['identity.enabled' => true, 'integration.test_bindings' => true]);
        (new IntegrationServiceProvider($app))->register();
        $events = OutboxEvent::where('resource_type', 'incident')->where('version', 2)->where('resource_id', $id)->where('barangay_id', $alert->barangay_id)->with('recipients')->get();
        foreach ($events as $event) {
            if ($event->recipients->contains('sms', true)) {
                throw new LogicException('Browser fixture cannot request external delivery.');
            }
            $app->make(OutboxDispatcher::class)->dispatchOne($event->event_id);
        }
        echo json_encode(['events' => $events->count(), 'external_delivery_requested' => false], JSON_THROW_ON_ERROR);
        exit;
    }
    echo json_encode(['status' => $alert->status, 'description' => $alert->description, 'victim_count' => $alert->victim_count,
        'revision' => $alert->assignment_revision, 'responses' => $db->table('alert_responses')->where('alert_id', $id)->count(),
        'rescues' => $db->table('rescues')->where('alert_id', $id)->count(), 'assignments' => $db->table('alert_assignments')->where('alert_id', $id)->count(),
        'resident_alerts' => $db->table('emergency_alerts')->where('resident_id', $alert->resident_id)->count(),
        'active_responder' => $db->table('alert_assignments')->where('alert_id', $id)->where('role', 'responder')->where('status', 'active')->value('user_id')], JSON_THROW_ON_ERROR);
    exit;
}
$scope = Barangay::forceCreate(['name' => 'Barangay Sampaguita'])->id;
$result = ['people' => []];
foreach (['resident', 'residentRescue', 'otherResident', 'captain', 'secretary', 'responder', 'replacement', 'rescuer', 'foreignResident'] as $key) {
    $role = match ($key) {
        'residentRescue', 'otherResident', 'foreignResident' => 'resident', 'replacement' => 'responder', default => $key
    };
    $area = $key === 'foreignResident' ? Barangay::forceCreate(['name' => 'Foreign operational QA area'])->id : $scope;
    $home = Household::forceCreate(['barangay_id' => $area, 'address' => '14 Riverside Street', 'map_x' => 0, 'map_y' => 100]);
    $password = 'Qa'.bin2hex(random_bytes(18)).'7';
    $email = 'operational-qa-'.bin2hex(random_bytes(12)).'@example.invalid';
    $user = User::forceCreate(['barangay_id' => $area, 'household_id' => $home->id, 'full_name' => 'Fictional QA '.$key,
        'email' => $email, 'password' => Hash::make($password), 'is_resident' => $role === 'resident', 'is_captain' => $role === 'captain', 'account_status' => 'Active']);
    if (in_array($role, ['secretary', 'responder', 'rescuer'], true)) {
        PersonnelAppointment::forceCreate(['user_id' => $user->id, 'barangay_id' => $area, 'role' => $role, 'status' => 'Active', 'source' => 'external']);
    }
    if ($role === 'resident') {
        Verification::forceCreate(['resident_id' => $user->id, 'barangay_id' => $area, 'review_status' => 'Approved']);
    }
    $result['people'][$key] = ['id' => $user->id, 'role' => $role, 'email' => $email, 'password' => $password];
}
$result['facility'] = Facility::forceCreate(['managed_by_barangay_id' => $scope, 'name' => 'Sampaguita Elementary School', 'type' => 'Evacuation Center', 'address' => 'School Street', 'capacity' => 250, 'active' => true])->id;
// Credentials are consumed only in process memory, never written to browser evidence.
echo json_encode($result, JSON_THROW_ON_ERROR);

<?php

use App\Models\Facility;
use App\Models\PersonnelAppointment;
use App\Models\User;
use App\Models\Verification;

// Test-only reference fixtures: production P1 readers/global registration remain disabled.
caseTest('Original operational controllers use P1 HTTP/session transport for both SQL workflow branches', function () use ($scope, $home, $port) {
    $people = [];
    foreach (['residentNoRescue' => 'resident', 'residentRescue' => 'resident', 'captain' => 'captain', 'secretary' => 'secretary', 'responder' => 'responder', 'rescuer' => 'rescuer'] as $key => $role) {
        $user = saveModel(User::class, ['barangay_id' => $scope->id, 'household_id' => $home->id, 'full_name' => 'UI '.$key, 'email' => bin2hex(random_bytes(8)).'@example.test', 'password' => 'Fixture123', 'account_status' => 'Active', 'is_resident' => $role === 'resident', 'is_captain' => $role === 'captain']);
        if ($role === 'resident') {
            saveModel(Verification::class, ['resident_id' => $user->id, 'barangay_id' => $scope->id, 'review_status' => 'Approved']);
        } elseif ($role !== 'captain') {
            saveModel(PersonnelAppointment::class, ['user_id' => $user->id, 'barangay_id' => $scope->id, 'role' => $role, 'source' => 'external', 'status' => 'Active']);
        }
        $people[$key] = ['id' => $user->id, 'email' => $user->email];
    }
    $facility = saveModel(Facility::class, ['managed_by_barangay_id' => $scope->id, 'name' => 'UI shelter', 'type' => 'Evacuation Center', 'address' => 'UI road', 'active' => true]);
    $fixture = tempnam(sys_get_temp_dir(), 'p2-ui-fixture-');
    file_put_contents($fixture, json_encode(['people' => $people, 'household' => $home->toArray(), 'barangay' => ['id' => $scope->id, 'name' => $scope->name], 'facility' => ['id' => $facility->id, 'name' => $facility->name, 'type' => $facility->type, 'is_active' => true]], JSON_THROW_ON_ERROR));
    try {
        $script = dirname(__DIR__, 3).'/tests/p2-workflow-http.mjs';
        $process = proc_open([getenv('NODE_BINARY') ?: 'node', '--experimental-vm-modules', $script, 'http://127.0.0.1:'.$port, $fixture], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        verify(is_resource($process), 'Could not start original-controller HTTP test.');
        fclose($pipes[0]);
        $output = stream_get_contents($pipes[1]);
        $error = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        verify(proc_close($process) === 0, 'Original-controller HTTP workflow failed: '.$output.$error);
        echo $output;
    } finally {
        unlink($fixture);
    }
});

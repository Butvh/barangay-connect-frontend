<?php

use App\Models\Facility;
use Illuminate\Support\Facades\DB;

caseTest('Concurrent actual rescuer dispatch cannot exceed one active assignment and completion releases its slot', function () use ($racePerson, $incidents, $captain, $raceOfficial, $scope) {
    $responder = $racePerson('responder');
    $rescuer = $racePerson('rescuer');
    $alerts = [];
    foreach ([0, 1] as $number) {
        $alert = $incidents->create($racePerson('resident'), [], 'audit-rescuer-sos-'.$number);
        $alert = $incidents->assign($captain, $alert['id'], ['personnel_id' => $responder->id, 'expected_revision' => 0], true);
        $alerts[] = $incidents->response($responder, $alert['id'], ['response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => true], 'audit-assessment-'.$number);
    }
    $results = raceP2(array_map(fn ($index) => [[$captain, $raceOfficial][$index]->id, 'assign-rescuer', [
        'alert_id' => $alerts[$index]['id'], 'personnel_id' => $rescuer->id, 'revision' => $alerts[$index]['assignment_revision'],
    ]], [0, 1]));
    $winners = array_values(array_filter($results, fn ($result) => isset($result['id'])));
    verify(count($winners) === 1 && count(array_filter($results, fn ($result) => ($result['error'] ?? null) === 'CAPACITY')) === 1, 'Rescuer last-slot race did not retain exactly one winner.');
    verify(DB::table('alert_assignments')->where(['user_id' => $rescuer->id, 'status' => 'active'])->count() === 1, 'Concurrent rescuer assignment exceeded limit1.');
    $facility = saveModel(Facility::class, ['managed_by_barangay_id' => $scope->id, 'name' => 'Fictional audit rescue shelter', 'type' => 'Evacuation Center', 'address' => 'Fictional audit road', 'active' => true]);
    $completed = $incidents->rescue($rescuer, $winners[0]['id'], ['facility_id' => $facility->id, 'rescue_status' => 'Completed'], 'audit-rescue-completion');
    verify($completed['status'] === 'Rescue in progress', 'Rescue completion incorrectly resolved the incident.');
    verify(DB::table('alert_assignments')->where(['user_id' => $rescuer->id, 'status' => 'active'])->count() === 0, 'Completed rescue did not release its slot.');
    $waiting = array_values(array_filter($alerts, fn ($alert) => $alert['id'] !== $winners[0]['id']))[0];
    $incidents->assign($captain, $waiting['id'], ['role' => 'rescuer', 'personnel_id' => $rescuer->id, 'expected_revision' => $waiting['assignment_revision']]);
    verify(DB::table('alert_assignments')->where(['user_id' => $rescuer->id, 'status' => 'active'])->count() === 1, 'Released rescuer slot could not be reused.');
});

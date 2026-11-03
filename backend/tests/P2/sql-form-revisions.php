<?php

use App\Models\Facility;
use Illuminate\Support\Facades\DB;

caseTest('Form response revision conflicts roll back and retry replays the original successful intent', function () use ($racePerson, $incidents, $captain) {
    $resident = $racePerson('resident');
    $responder = $racePerson('responder');
    $alert = $incidents->create($resident, [], 'form-response-sos');
    $incidents->assign($captain, $alert['id'], ['personnel_id' => $responder->id, 'expected_revision' => 0], true);
    $body = ['response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => false, 'expected_revision' => 0];
    expectsProblem(fn () => $incidents->response($responder, $alert['id'], $body, 'form-stale-response'), 'CONFLICT');
    verify(DB::table('alert_responses')->where('alert_id', $alert['id'])->count() === 0, 'Stale response persisted.');
    $body['expected_revision'] = 1;
    $saved = $incidents->response($responder, $alert['id'], $body, 'form-response-intent');
    $retry = $incidents->response($responder, $alert['id'], $body, 'form-response-intent');
    verify($saved['id'] === $retry['id'] && DB::table('alert_responses')->where('alert_id', $alert['id'])->count() === 1, 'Response retry duplicated a log.');
    verify($saved['status'] === 'Responding', 'No-rescue completion auto-resolved.');
    $incidents->resolve($captain, $alert['id'], ['expected_revision' => $saved['assignment_revision']]);
});

caseTest('Form rescue and resident details keep the observed revision and reject stale writes', function () use ($racePerson, $incidents, $captain, $scope) {
    $resident = $racePerson('resident');
    $responder = $racePerson('responder');
    $rescuer = $racePerson('rescuer');
    $alert = $incidents->create($resident, [], 'form-rescue-sos');
    $incidents->assign($captain, $alert['id'], ['personnel_id' => $responder->id, 'expected_revision' => 0], true);
    expectsProblem(fn () => $incidents->details($resident, $alert['id'], ['description' => 'stale', 'expected_revision' => 0]), 'CONFLICT');
    $incidents->details($resident, $alert['id'], ['description' => 'current correction', 'expected_revision' => 1]);
    $incidents->response($responder, $alert['id'], ['response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => true, 'expected_revision' => 2], 'form-needed-response');
    $incidents->assign($captain, $alert['id'], ['role' => 'rescuer', 'personnel_id' => $rescuer->id, 'expected_revision' => 3]);
    $facility = saveModel(Facility::class, ['managed_by_barangay_id' => $scope->id, 'name' => 'Form shelter', 'type' => 'Evacuation Center', 'address' => 'Shelter road', 'active' => true]);
    $body = ['facility_id' => $facility->id, 'rescue_status' => 'Completed', 'expected_revision' => 2];
    expectsProblem(fn () => $incidents->rescue($rescuer, $alert['id'], $body, 'form-stale-rescue'), 'CONFLICT');
    verify(DB::table('rescues')->where('alert_id', $alert['id'])->count() === 0, 'Stale rescue persisted.');
    $body['expected_revision'] = 4;
    $saved = $incidents->rescue($rescuer, $alert['id'], $body, 'form-rescue-intent');
    $incidents->rescue($rescuer, $alert['id'], $body, 'form-rescue-intent');
    verify(DB::table('rescues')->where('alert_id', $alert['id'])->count() === 1 && $saved['status'] === 'Rescue in progress', 'Rescue retry duplicated work or auto-resolved.');
    $incidents->resolve($captain, $alert['id'], ['expected_revision' => $saved['assignment_revision']]);
});

<?php

use App\Contracts\P2\IncidentPhotoAuthorization;
use App\Contracts\P2\Store;
use App\Models\User;
use App\Services\Identity\EffectiveIdentity;
use App\Services\P2\Persistence\IncidentPhotoPolicy;
use App\Support\ApiProblem;
use Illuminate\Support\Facades\DB;

caseTest('Exact photo attach requires declared actor/incident locks, current owner approval and original revision', function () use ($app, $racePerson, $incidents, $captain) {
    verify(! $app->bound(IncidentPhotoAuthorization::class), 'Unratified photo policy was bound.');
    $policy = $app->make(IncidentPhotoPolicy::class);
    verify($policy instanceof IncidentPhotoAuthorization, 'Photo policy port missing.');
    $resident = $racePerson('resident');
    $other = $racePerson('resident');
    $alert = $incidents->create($resident, [], 'photo-owner-sos');
    $identity = $resident->observedIdentity();
    foreach ([[], ['person:'.$resident->id]] as $keys) {
        $denied = false;
        try {
            app(Store::class)->transaction($keys, fn () => $policy->assertAttach($identity, $alert['id'], 0));
        } catch (LogicException) {
            $denied = true;
        }
        verify($denied, 'Attach accepted an incomplete lock plan.');
    }
    $guard = fn ($actor, Closure $work) => app(Store::class)->transaction(['person:'.$actor->id, 'incident:'.$alert['id']], $work);
    $guard($resident, fn () => $policy->assertAttach($identity, $alert['id'], 0));
    $guard($other, fn () => expectsProblem(fn () => $policy->assertAttach($other->observedIdentity(), $alert['id'], 99), 'NOT_FOUND'));
    $guard($captain, fn () => expectsProblem(fn () => $policy->assertAttach($captain->observedIdentity(), $alert['id'], 0), 'NOT_FOUND'));
    $incidents->details($resident, $alert['id'], ['description' => 'New details']);
    $guard($resident, fn () => expectsProblem(fn () => $policy->assertAttach($identity, $alert['id'], 0), 'CONFLICT'));
    DB::table('emergency_alerts')->where('id', $alert['id'])->update(['status' => 'Acknowledged']);
    $guard($resident, fn () => $policy->assertAttach($identity, $alert['id'], 1));
    foreach (['Responding', 'Rescue in progress'] as $status) {
        DB::table('emergency_alerts')->where('id', $alert['id'])->update(['status' => $status]);
        $guard($resident, fn () => expectsProblem(fn () => $policy->assertAttach($identity, $alert['id'], 1), 'INVALID_STATE'));
    }
    DB::table('emergency_alerts')->where('id', $alert['id'])->update(['status' => 'Resolved']);
    $guard($resident, fn () => expectsProblem(fn () => $policy->assertAttach($identity, $alert['id'], 1), 'INVALID_STATE'));
    // Guard bookkeeping must not outlive the Store closure, even in an outer transaction.
    DB::transaction(function () use ($policy, $guard, $resident, $identity, $alert) {
        $guard($resident, fn () => null);
        $denied = false;
        try {
            $policy->assertAttach($identity, $alert['id'], 1);
        } catch (LogicException) {
            $denied = true;
        }
        verify($denied, 'Attach reused an expired declared lock scope.');
    });
});

caseTest('Exact photo downloads follow current latest assignments and resolved history without household-wide access', function () use ($app, $racePerson, $incidents, $captain) {
    $policy = $app->make(IncidentPhotoPolicy::class);
    $secretary = $racePerson('secretary');
    $resident = $racePerson('resident');
    $other = $racePerson('resident');
    $responder = $racePerson('responder');
    $replacement = $racePerson('responder');
    $rescuer = $racePerson('rescuer');
    $alert = $incidents->create($resident, [], 'photo-read-sos');
    $incidents->assign($captain, $alert['id'], ['personnel_id' => $responder->id, 'expected_revision' => 0], true);
    foreach ([$resident, $captain, $secretary, $responder] as $actor) {
        $policy->assertDownload($actor->observedIdentity(), $alert['id']);
    }
    foreach ([$other, $replacement, $rescuer] as $actor) {
        expectsProblem(fn () => $policy->assertDownload($actor->observedIdentity(), $alert['id']), 'NOT_FOUND');
    }
    // Same resident, another exact incident: the assigned first incident is not authority.
    $second = DB::table('emergency_alerts')->insertGetId(['barangay_id' => $resident->barangayId, 'resident_id' => $resident->id, 'household_id' => $incidents->get($resident, $alert['id'])['household_id'], 'alert_type' => 'Other', 'location_label' => 'Fixture', 'status' => 'Resolved', 'reported_at' => now()]);
    expectsProblem(fn () => $policy->assertDownload($responder->observedIdentity(), $second), 'NOT_FOUND');
    $assignment = DB::table('alert_assignments')->where('alert_id', $alert['id'])->first();
    foreach (['completed', 'closed'] as $status) {
        DB::table('alert_assignments')->where('id', $assignment->id)->update(['status' => $status]);
        expectsProblem(fn () => $policy->assertDownload($responder->observedIdentity(), $alert['id']), 'NOT_FOUND');
    }
    DB::table('alert_assignments')->where('id', $assignment->id)->update(['status' => 'cancelled']);
    expectsProblem(fn () => $policy->assertDownload($responder->observedIdentity(), $alert['id']), 'NOT_FOUND');
    DB::table('alert_assignments')->where('id', $assignment->id)->update(['status' => 'completed']);
    DB::table('alert_assignments')->insert(['alert_id' => $alert['id'], 'barangay_id' => $resident->barangayId, 'user_id' => $replacement->id, 'role' => 'responder', 'assigned_by' => $captain->id, 'status' => 'active', 'assigned_at' => now()]);
    expectsProblem(fn () => $policy->assertDownload($responder->observedIdentity(), $alert['id']), 'NOT_FOUND');
    $policy->assertDownload($replacement->observedIdentity(), $alert['id']);
    DB::table('alert_assignments')->insert(['alert_id' => $alert['id'], 'barangay_id' => $resident->barangayId, 'user_id' => $rescuer->id, 'role' => 'rescuer', 'assigned_by' => $captain->id, 'status' => 'closed', 'assigned_at' => now()]);
    expectsProblem(fn () => $policy->assertDownload($rescuer->observedIdentity(), $alert['id']), 'NOT_FOUND');
    DB::table('alert_assignments')->where('alert_id', $alert['id'])->where('role', 'rescuer')->update(['status' => 'active']);
    $policy->assertDownload($rescuer->observedIdentity(), $alert['id']);
    DB::table('emergency_alerts')->where('id', $alert['id'])->update(['status' => 'Resolved']);
    foreach ([$responder, $replacement, $rescuer] as $actor) {
        expectsProblem(fn () => $policy->assertDownload($actor->observedIdentity(), $alert['id']), 'NOT_FOUND');
    }
    foreach ([$resident, $captain, $secretary] as $actor) {
        $policy->assertDownload($actor->observedIdentity(), $alert['id']);
    }
    $denied = false;
    DB::transaction(function () use ($policy, $resident, $alert, &$denied) {
        try {
            $policy->assertDownload($resident->observedIdentity(), $alert['id']);
        } catch (LogicException) {
            $denied = true;
        }
    });
    verify($denied, 'Photo read expanded an unknown caller transaction.');
});

caseTest('Photo policy rejects stale generation, removed/inactive roles, cross-scope and current revoked residency', function () use ($app, $racePerson, $incidents, $captain) {
    $policy = $app->make(IncidentPhotoPolicy::class);
    $resident = $racePerson('resident');
    $responder = $racePerson('responder');
    $alert = $incidents->create($resident, [], 'photo-revocation-sos');
    $incidents->assign($captain, $alert['id'], ['personnel_id' => $responder->id, 'expected_revision' => 0], true);
    DB::table('users')->where('id', $resident->id)->update(['account_status' => 'Inactive']);
    try {
        $policy->assertDownload($resident->observedIdentity(), $alert['id']);
        throw new RuntimeException('Inactive account read accepted.');
    } catch (ApiProblem $e) {
        verify($e->status === 401, 'Unexpected inactive denial.');
    }
    DB::table('users')->where('id', $resident->id)->update(['account_status' => 'Active']);
    foreach ([['status' => 'Inactive'], ['status' => 'Unassigned', 'role' => null]] as $state) {
        DB::table('personnel_appointments')->where('user_id', $responder->id)->update($state);
        try {
            $policy->assertDownload($responder->observedIdentity(), $alert['id']);
            throw new RuntimeException('Revoked role read accepted.');
        } catch (ApiProblem $e) {
            verify($e->status === 401, 'Unexpected role denial.');
        }
    }
    DB::table('users')->where('id', $resident->id)->increment('auth_version');
    try {
        $policy->assertDownload($resident->observedIdentity(), $alert['id']);
        throw new RuntimeException('Old generation accepted.');
    } catch (ApiProblem $e) {
        verify($e->status === 401, 'Unexpected generation denial.');
    }
    DB::table('users')->where('id', $resident->id)->update(['auth_version' => 0]);
    $scope = DB::table('barangays')->insertGetId(['name' => 'Photo other scope']);
    $crossUser = saveModel(User::class, ['barangay_id' => $scope, 'full_name' => 'Other scope photo reader', 'email' => bin2hex(random_bytes(8)).'@example.test', 'password' => 'Fixture123', 'account_status' => 'Active', 'is_captain' => true]);
    $cross = EffectiveIdentity::fromUser($crossUser->refresh());
    expectsProblem(fn () => $policy->assertDownload($cross, $alert['id']), 'NOT_FOUND');
    config(['database.connections.p2_photo_peer' => config('database.connections.mysql')]);
    app(Store::class)->transaction(['person:'.$resident->id, 'incident:'.$alert['id']], function () use ($resident, $policy, $alert) {
        DB::table('verifications')->where('resident_id', $resident->id)->first();
        DB::connection('p2_photo_peer')->table('verifications')->where('resident_id', $resident->id)->update(['review_status' => 'Rejected']);
        expectsProblem(fn () => $policy->assertAttach($resident->observedIdentity(), $alert['id'], 1), 'FORBIDDEN');
    });
    DB::purge('p2_photo_peer');
    $nearby = $incidents->nearby($resident);
    foreach ($nearby as $row) {
        verify(! array_intersect(['photo_upload_id', 'photo_id', 'photos', 'object_key', 'sha256'], array_keys($row)), 'Photo metadata escaped nearby projection.');
    }
});

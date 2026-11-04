<?php

use App\Contracts\P2\GuardedStore;
use App\Contracts\P2\Store;
use App\Services\P2\Persistence\IncidentPhotoPolicy;
use App\Support\ApiProblem;
use Illuminate\Support\Facades\DB;

// Source-boundary preparation only: no byte service, metadata table or attachment is simulated.
caseTest('Photo-authorized caller rolls back real details and command outcome on a later failure; frozen intent then replays once', function () use ($app, $racePerson, $incidents) {
    $resident = $racePerson('resident');
    $alert = $incidents->create($resident, [], 'photo-boundary-sos');
    $policy = $app->make(IncidentPhotoPolicy::class);
    $store = $app->make(Store::class);
    $body = ['description' => 'Original frozen details', 'expected_revision' => 0];
    $key = 'photo-boundary-details';
    $tables = ['emergency_alerts', 'incident_status_history', 'activity_logs', 'outbox_events', 'idempotency_requests'];
    $counts = fn () => array_map(fn ($table) => DB::table($table)->count(), $tables);
    $before = $counts();
    try {
        $store->transaction(['person:'.$resident->id, 'incident:'.$alert['id']], function () use ($policy, $resident, $alert, $incidents, $body, $key) {
            $policy->assertAttach($resident->observedIdentity(), $alert['id'], $body['expected_revision']);
            $written = $incidents->details($resident, $alert['id'], $body, $key);
            verify($written['assignment_revision'] === 1, 'Actual details command did not run.');
            throw new RuntimeException('injected-after-real-details');
        });
        throw new RuntimeException('Failure injection did not run.');
    } catch (RuntimeException $e) {
        verify($e->getMessage() === 'injected-after-real-details', 'Unexpected boundary failure.');
    }
    verify($before === $counts(), 'Caller failure leaked source/history/audit/outbox/command rows.');
    $current = $incidents->get($resident, $alert['id']);
    verify($current['assignment_revision'] === 0 && $current['description'] !== $body['description'], 'Source patch escaped rollback.');
    verify($store instanceof GuardedStore, 'Missing real guarded Store.');
    try {
        $store->assertIncidentLocked($alert['id']);
        throw new RuntimeException('Exception leaked declared incident scope.');
    } catch (LogicException) {
    }
    $store->transaction(['person:'.$resident->id, 'incident:'.$alert['id']], function () use ($policy, $resident, $alert, $incidents, $body, $key) {
        $policy->assertAttach($resident->observedIdentity(), $alert['id'], $body['expected_revision']);
        $incidents->details($resident, $alert['id'], $body, $key);
    });
    $committed = $counts();
    // A fresh attach attempt is now stale; original command replay must not run that preflight again.
    $store->transaction(['person:'.$resident->id, 'incident:'.$alert['id']], fn () => expectsProblem(fn () => $policy->assertAttach($resident->observedIdentity(), $alert['id'], 0), 'CONFLICT'));
    $replayed = $incidents->details($resident, $alert['id'], $body, $key);
    verify($replayed['assignment_revision'] === 1 && $committed === $counts(), 'Frozen intent replay wrote again or refreshed its revision.');
    expectsProblem(fn () => $incidents->details($resident, $alert['id'], ['description' => 'Different input', 'expected_revision' => 0], $key), 'CONFLICT');
    DB::table('users')->where('id', $resident->id)->increment('auth_version');
    try {
        $incidents->details($resident, $alert['id'], $body, $key);
        throw new RuntimeException('Successful command replay bypassed generation revocation.');
    } catch (ApiProblem $e) {
        verify($e->status === 401, 'Unexpected revoked replay response.');
    }
    verify($committed === $counts(), 'Denied replay changed command state.');
});

caseTest('Actual manual transfer and cancellation immediately revoke exact photo source access', function () use ($app, $racePerson, $incidents, $captain) {
    $owner = $racePerson('resident');
    $old = $racePerson('responder');
    $next = $racePerson('responder');
    $policy = $app->make(IncidentPhotoPolicy::class);
    $alert = $incidents->create($owner, [], 'photo-transfer-boundary');
    $assigned = $incidents->assign($captain, $alert['id'], ['personnel_id' => $old->id, 'expected_revision' => 0], true);
    $policy->assertDownload($old->observedIdentity(), $alert['id']);
    $assignmentId = (int) DB::table('alert_assignments')->where('alert_id', $alert['id'])->where('status', 'active')->value('id');
    $changed = $incidents->changeAssignment($captain, $assignmentId, ['personnel_id' => $next->id, 'reason' => 'Fictional shift transfer', 'expected_revision' => $assigned['assignment_revision']], true);
    expectsProblem(fn () => $policy->assertDownload($old->observedIdentity(), $alert['id']), 'NOT_FOUND');
    $policy->assertDownload($next->observedIdentity(), $alert['id']);
    $activeId = (int) DB::table('alert_assignments')->where('alert_id', $alert['id'])->where('status', 'active')->value('id');
    $incidents->changeAssignment($captain, $activeId, ['reason' => 'Fictional cancellation', 'expected_revision' => $changed['assignment_revision']], false);
    expectsProblem(fn () => $policy->assertDownload($next->observedIdentity(), $alert['id']), 'NOT_FOUND');
    $policy->assertDownload($owner->observedIdentity(), $alert['id']);
});

caseTest('Current source commands reject supplied upload references while real photo integration is unavailable', function () use ($racePerson, $incidents) {
    $owner = $racePerson('resident');
    $alert = $incidents->create($owner, [], 'photo-disabled-boundary');
    $before = [DB::table('idempotency_requests')->count(), DB::table('activity_logs')->count()];
    foreach (['upload_id' => '00000000-0000-4000-8000-000000000001', 'upload_ids' => ['unrecorded'], 'photos' => ['filename.png']] as $field => $value) {
        expectsProblem(fn () => $incidents->create($owner, [$field => $value], 'photo-disabled-create-'.$field), 'VALIDATION');
        expectsProblem(fn () => $incidents->details($owner, $alert['id'], [$field => $value, 'expected_revision' => 0], 'photo-disabled-details-'.$field), 'VALIDATION');
    }
    verify($before === [DB::table('idempotency_requests')->count(), DB::table('activity_logs')->count()], 'Unavailable photo input left durable success.');
    verify($incidents->get($owner, $alert['id'])['assignment_revision'] === 0, 'Unavailable input advanced source revision.');
});

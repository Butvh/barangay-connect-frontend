<?php

use App\Models\TanodMembership;
use App\Models\User;
use Illuminate\Support\Facades\DB;

$finalFailures = [];
$finalCase = function (string $name, Closure $work) use (&$finalFailures) {
    try {
        caseTest($name, $work);
    } catch (Throwable $error) {
        $finalFailures[] = $name.': '.$error->getMessage();
        echo 'FAIL '.end($finalFailures).PHP_EOL;
    }
};
$finalCase('Unauthorized resident and unassigned staff cannot probe incident revisions', function () use ($racePerson, $incidents) {
    $owner = $racePerson('resident');
    $other = $racePerson('resident');
    $staff = $racePerson('responder');
    $rescuer = $racePerson('rescuer');
    $alert = $incidents->create($owner, [], 'final-private-sos');
    foreach ([0, 99] as $revision) {
        expectsProblem(fn () => $incidents->details($other, $alert['id'], ['description' => 'unauthorized', 'expected_revision' => $revision]), 'NOT_FOUND');
        expectsProblem(fn () => $incidents->response($staff, $alert['id'], ['response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => false, 'expected_revision' => $revision], 'final-private-response-'.$revision), 'FORBIDDEN');
        expectsProblem(fn () => $incidents->rescue($rescuer, $alert['id'], ['facility_id' => 1, 'rescue_status' => 'Completed', 'expected_revision' => $revision], 'final-private-rescue-'.$revision), 'FORBIDDEN');
    }
});
$finalCase('Resident editors reject a stale second tab and identical retries add no extra audit', function () use ($racePerson, $incidents) {
    $resident = $racePerson('resident');
    $alert = $incidents->create($resident, [], 'final-edit-sos');
    $body = ['description' => 'First editor', 'expected_revision' => 0];
    $saved = $incidents->details($resident, $alert['id'], $body, 'final-edit-intent');
    $before = DB::table('activity_logs')->where(['resource_id' => $alert['id'], 'action' => 'Incident details updated'])->count();
    $incidents->details($resident, $alert['id'], $body, 'final-edit-intent');
    verify(DB::table('activity_logs')->where(['resource_id' => $alert['id'], 'action' => 'Incident details updated'])->count() === $before, 'Replay created another audit.');
    verify($saved['assignment_revision'] === 1, 'Details edit did not advance revision.');
    expectsProblem(fn () => $incidents->details($resident, $alert['id'], ['description' => 'Stale second editor', 'expected_revision' => 0], 'second-editor-intent'), 'CONFLICT');
    verify($incidents->get($resident, $alert['id'])['description'] === 'First editor', 'Stale details overwrote the first editor.');
});
$finalCase('Feedback rejects current inactive Tanod membership or account after an older snapshot', function () use ($racePerson, $civic, $captain, $scope, $home) {
    $resident = $racePerson('resident');
    $tanod = saveModel(User::class, ['barangay_id' => $scope->id, 'household_id' => $home->id, 'full_name' => 'Inactive Tanod fixture', 'email' => bin2hex(random_bytes(8)).'@example.test', 'password' => 'Fixture123', 'account_status' => 'Active']);
    saveModel(TanodMembership::class, ['user_id' => $tanod->id, 'barangay_id' => $scope->id, 'active' => true]);
    config(['database.connections.p2_final_peer' => config('database.connections.mysql')]);
    foreach (['membership', 'account'] as $which) {
        DB::table('tanod_memberships')->where('user_id', $tanod->id)->update(['active' => true]);
        DB::table('users')->where('id', $tanod->id)->update(['account_status' => 'Active']);
        $feedback = $civic->submitFeedback($resident, ['type' => 'complaint', 'category' => 'Drainage', 'description' => 'Fixture concern'], 'final-tanod-'.$which);
        DB::transaction(function () use ($tanod, $which, $civic, $captain, $feedback) {
            DB::table('tanod_memberships')->where('user_id', $tanod->id)->first();
            $peer = DB::connection('p2_final_peer');
            if ($which === 'membership') {
                $peer->table('tanod_memberships')->where('user_id', $tanod->id)->update(['active' => false]);
            } else {
                $peer->table('users')->where('id', $tanod->id)->update(['account_status' => 'Inactive']);
            }
            expectsProblem(fn () => $civic->assignFeedback($captain, $feedback['id'], ['tanod_id' => $tanod->id, 'expected_revision' => 0]), 'VALIDATION');
        });
        verify(DB::table('community_feedback')->where('id', $feedback['id'])->value('assigned_tanod_id') === null, 'Inactive Tanod was assigned.');
    }
    DB::purge('p2_final_peer');
});
if ($finalFailures) {
    throw new RuntimeException(implode(PHP_EOL, $finalFailures));
}

<?php

namespace Tests\Integration;

use App\Contracts\P2\ReferenceData;
use App\Models\Barangay;
use App\Models\Household;
use App\Models\PersonnelAppointment;
use App\Models\User;
use App\Models\Verification;
use App\Providers\P2ServiceProvider;
use App\Services\Incidents\IncidentService;
use App\Services\P2\Persistence\RelationalStore;
use Illuminate\Support\Facades\DB;
use Tests\MysqlDbaTestCase;

/** Actual transfer with both candidate IDs lower than the actor; no audience-wide locks. */
class P2GuardPlanContractTest extends MysqlDbaTestCase
{
    public function test_transfer_prelocks_sorted_lower_id_participants_and_preserves_history(): void
    {
        if (! class_exists(RelationalStore::class)) {
            $this->markTestSkipped('Requires the published P1/P2 composition.');
        }
        $app = $this->app;
        config(['identity.enabled' => true, 'messaging.sms.enabled' => false, 'messaging.make.enabled' => false]);
        require __DIR__.'/../P2/bindings.php';
        $app->register(P2ServiceProvider::class);
        $scope = Barangay::forceCreate(['name' => 'Fictional lower-ID transfer']);
        $home = Household::forceCreate(['barangay_id' => $scope->id, 'address' => 'Fictional transfer fixture']);
        $users = [];
        foreach (['responder', 'responder', 'captain', 'resident'] as $role) {
            $user = User::forceCreate(['barangay_id' => $scope->id, 'household_id' => $home->id, 'full_name' => 'Fictional transfer '.$role,
                'email' => bin2hex(random_bytes(10)).'@example.invalid', 'password' => bin2hex(random_bytes(24)), 'account_status' => 'Active', 'is_captain' => $role === 'captain', 'is_resident' => $role === 'resident']);
            if ($role === 'responder') {
                PersonnelAppointment::forceCreate(['user_id' => $user->id, 'barangay_id' => $scope->id, 'role' => $role, 'source' => 'external', 'status' => 'Active']);
            }
            $users[] = $user;
        }
        [$old, $next, $captain, $resident] = $users;
        Verification::forceCreate(['resident_id' => $resident->id, 'barangay_id' => $scope->id, 'review_status' => 'Approved']);
        $refs = $app->make(ReferenceData::class);
        $actor = $refs->actorFor($captain->id);
        $service = $app->make(IncidentService::class);
        $alert = $service->create($refs->actorFor($resident->id), [], 'lower-id-sos');
        $assigned = $service->assign($actor, $alert['id'], ['personnel_id' => $old->id, 'expected_revision' => 0], true);
        $assignment = DB::table('alert_assignments')->where('alert_id', $alert['id'])->first();
        $guardOrder = [];
        $held = [];
        $late = [];
        $source = false;
        $tracking = true;
        DB::listen(function ($query) use (&$guardOrder, &$held, &$late, &$source, &$tracking) {
            if (! $tracking || ! str_contains(strtolower($query->sql), 'for update')) {
                return;
            }
            if (str_contains($query->sql, 'from `capacity_guards`') && ($query->bindings[0] ?? null) === 'person' && ($query->bindings[2] ?? null) === 'operations') {
                $guardOrder[] = (int) $query->bindings[1];
            }
            if (str_contains($query->sql, 'from `emergency_alerts`')) {
                $source = true;
            }
            if (str_contains($query->sql, 'from `users`')) {
                $count = preg_match('/where `id` in \(([^)]+)\)/', $query->sql, $matches) ? substr_count($matches[1], '?') : 1;
                foreach (array_slice($query->bindings, 0, $count) as $id) {
                    if ($source && ! isset($held[$id])) {
                        $late[] = $id;
                    }
                    $held[$id] = true;
                }
            }
        });
        try {
            $result = $service->changeAssignment($actor, $assignment->id, ['personnel_id' => $next->id, 'expected_revision' => $assigned['assignment_revision'], 'reason' => 'Fictional transfer review'], true);
        } finally {
            $tracking = false;
        }
        $this->assertSame([$old->id, $next->id, $captain->id], $guardOrder);
        $this->assertSame([$old->id, $next->id, $captain->id], array_keys($held));
        $this->assertTrue($source);
        $this->assertSame([], $late);
        $this->assertSame('reassigned', DB::table('alert_assignments')->where('id', $assignment->id)->value('status'));
        $this->assertSame(0, DB::table('alert_assignments')->where(['user_id' => $old->id, 'status' => 'active'])->count());
        $this->assertSame(1, DB::table('alert_assignments')->where(['user_id' => $next->id, 'status' => 'active'])->count());
        $this->assertSame(2, DB::table('alert_assignments')->where('alert_id', $alert['id'])->count());
        $this->assertSame($next->id, $result['assigned_responder_id']);
        $this->assertSame(2, $result['assignment_revision']);
        $this->assertSame(0, DB::table('sms_deliveries')->count());
    }
}

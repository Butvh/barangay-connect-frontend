<?php

namespace Tests\Feature;

use App\Models\Verification;
use App\Providers\IntegrationServiceProvider;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Tests\Support\CombinedMysql;
use Tests\Support\LockedUserIds;
use Tests\TestCase;

/** Required release gate: do not weaken or mark expected-success while P2 fixes its lock plan. */
final class CombinedP2LockOrderTest extends TestCase
{
    use CombinedMysql;

    public function test_actual_assignment_never_acquires_a_new_person_row_after_the_incident_lock(): void
    {
        $this->combinedMysql();
        config(['integration.test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
        $resident = $this->sourceUser();
        $captain = $this->sourceUser('captain', $resident->barangay_id);
        $responder = $this->sourceUser('responder', $resident->barangay_id);
        Verification::forceCreate(['resident_id' => $resident->id, 'barangay_id' => $resident->barangay_id, 'review_status' => 'Approved']);
        $refs = app('App\\Contracts\\P2\\ReferenceData');
        $service = app('App\\Services\\Incidents\\IncidentService');
        $actor = $refs->actorFor($captain->id);
        $alert = $service->create($refs->actorFor($resident->id), ['alert_type' => 'Flood'], 'p1-lock-order-fixture');
        $tracking = true;
        $incidentLocked = false;
        $heldPeople = [];
        $latePeople = [];
        DB::listen(function (QueryExecuted $query) use (&$tracking, &$incidentLocked, &$heldPeople, &$latePeople) {
            if (! $tracking || ! str_contains(strtolower($query->sql), 'for update')) {
                return;
            }
            if (str_contains($query->sql, 'from `emergency_alerts`')) {
                $incidentLocked = true;
            }
            if (str_contains($query->sql, 'from `users`')) {
                foreach (LockedUserIds::from($query->sql, $query->bindings) as $id) {
                    if ($incidentLocked && ! isset($heldPeople[$id])) {
                        $latePeople[] = $id;
                    }
                    $heldPeople[$id] = true;
                }
            }
        });
        try {
            $service->assign($actor, $alert['id'], ['personnel_id' => $responder->id, 'expected_revision' => 0], true);
        } finally {
            $tracking = false;
        }
        $this->assertTrue($incidentLocked, 'The actual domain transaction must acquire an incident lock.');
        $this->assertSame([], array_values(array_unique($latePeople)), 'P2 lock-order blocker: all newly locked participants must be planned before incident/assignment/facility locks. Reentrant already-held user locks are allowed.');
    }
}

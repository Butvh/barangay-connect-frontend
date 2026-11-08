<?php

namespace Tests\Feature;

use App\Contracts\P2\ReferenceData;
use App\Providers\IntegrationServiceProvider;
use App\Services\Administration\PersonnelAdministration;
use App\Services\Civic\CivicService;
use App\Services\Identity\EffectiveIdentity;
use App\Services\P2\Problem;
use App\Support\ApiProblem;
use Illuminate\Support\Facades\DB;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class Pr51GeneralFeedbackIntegrationTest extends TestCase
{
    use CombinedMysql;

    public function test_real_staff_reassignment_retains_review_actor_history_and_rejects_original_identity_replay(): void
    {
        $this->combinedMysql();
        config(['integration.test_bindings' => true, 'integration.admin_test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
        $resident = $this->sourceUser();
        $captain = $this->sourceUser('captain', $resident->barangay_id);
        $secretary = $this->sourceUser('secretary', $resident->barangay_id);
        $refs = app(ReferenceData::class);
        $civic = app(CivicService::class);
        $row = $civic->submitFeedback($refs->actorFor($resident->id), ['type' => 'general', 'rating' => 5, 'comment' => 'Fictional complete history remains after staff reassignment.'], 'integrated-submit-'.bin2hex(random_bytes(8)));
        $original = $refs->actorFor($secretary->id);
        $key = 'integrated-review-'.bin2hex(random_bytes(8));
        $reviewed = $civic->reviewFeedback($original, $row['id'], ['expected_revision' => 0], $key);
        $audit = (array) DB::table('activity_logs')->where('resource_type', 'feedback')->where('resource_id', $row['id'])->where('action', 'General feedback reviewed')->sole();
        $appointment = DB::table('personnel_appointments')->where('user_id', $secretary->id)->sole();
        app(PersonnelAdministration::class)->change(EffectiveIdentity::fromUser($captain), $secretary->id, 'reassign', ['role' => 'responder', 'effective_date' => now('Asia/Manila')->format('Y-m-d'), 'expected_revision' => $appointment->revision]);
        $this->assertSame('responder', EffectiveIdentity::fromUser($secretary->fresh())->role);
        $this->assertSame($secretary->id, $reviewed['reviewed_by']);
        $this->assertSame($audit, (array) DB::table('activity_logs')->where('id', $audit['id'])->sole());
        $this->assertSame('secretary', $audit['role_at_action']);
        $this->assertSame($secretary->full_name, $audit['actor_name']);
        $before = DB::table('idempotency_requests')->count();
        try {
            $civic->reviewFeedback($original, $row['id'], ['expected_revision' => 0], $key);
            $this->fail('Original secretary identity replayed after a real staff reassignment.');
        } catch (Problem|ApiProblem $error) {
            $this->assertContains($error->errorCode, ['AUTH', 'FORBIDDEN', 'CONFLICT']);
        }
        $this->assertSame($before, DB::table('idempotency_requests')->count());
        $historical = $civic->feedbackItem($refs->actorFor($resident->id), $row['id']);
        $this->assertSame($row['comment'], $historical['comment']);
        $this->assertSame($secretary->id, $historical['reviewed_by']);
        $this->assertSame(1, $historical['revision']);
    }
}

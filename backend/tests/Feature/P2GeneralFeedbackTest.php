<?php

namespace Tests\Feature;

use App\Contracts\P2\ReferenceData;
use App\Models\User;
use App\Providers\IntegrationServiceProvider;
use App\Services\Civic\CivicService;
use App\Services\Identity\EffectiveIdentity;
use App\Services\P2\Problem;
use App\Support\ApiProblem;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Bootstrap\LoadConfiguration;
use Illuminate\Support\Facades\DB;
use Tests\Support\CombinedMysql;
use Tests\Support\LockedUserIds;
use Tests\TestCase;

/** Actual MySQL services/controllers; requires the DBA's ratified migration. */
final class P2GeneralFeedbackTest extends TestCase
{
    use CombinedMysql;

    public function createApplication()
    {
        $app = require __DIR__.'/../../bootstrap/app.php';
        // Enable the actual route fragments before route registration, only in
        // this guarded disposable test application. Product gates stay closed.
        $app->afterBootstrapping(LoadConfiguration::class, function (): void {
            config(['identity.enabled' => true, 'integration.test_bindings' => true, 'integration.p2_enabled' => true]);
        });
        $app->make(Kernel::class)->bootstrap();

        return $app;
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        config(['integration.test_bindings' => true, 'integration.p2_enabled' => true]);
        (new IntegrationServiceProvider($this->app))->register();
    }

    private function submission(): array
    {
        $owner = $this->sourceUser();
        $service = app(CivicService::class);
        $row = $service->submitFeedback(app(ReferenceData::class)->actorFor($owner->id), ['type' => 'general', 'rating' => 4, 'comment' => 'Complete fictional feedback retained for historical reads.'], 'gf-submit-'.bin2hex(random_bytes(8)));

        return [$owner, $service, $row];
    }

    private function signIn(User $user): void
    {
        $identity = EffectiveIdentity::fromUser($user->fresh());
        $this->actingAs($user->fresh())->withSession($identity->sessionSnapshot());
    }

    private function counts(): array
    {
        return array_map(fn ($table) => DB::table($table)->count(), ['activity_logs', 'idempotency_requests', 'outbox_events', 'notifications']);
    }

    public function test_both_official_http_commands_preserve_content_and_replay_without_delivery_effects(): void
    {
        foreach (['secretary', 'captain'] as $role) {
            [$owner, $service, $row] = $this->submission();
            $official = $this->sourceUser($role, $owner->barangay_id);
            $this->signIn($official);
            $key = 'gf-review-'.bin2hex(random_bytes(8));
            $before = $this->counts();
            $this->postJson('/api/v1/feedback/'.$row['id'].'/review', ['expected_revision' => 0], ['Idempotency-Key' => $key])
                ->assertOk()->assertJsonPath('data.reviewed_by', $official->id)->assertJsonPath('data.revision', 1)->assertJsonPath('data.status', null);
            $afterReview = $this->counts();
            $this->assertSame([$before[0] + 1, $before[1] + 1, $before[2], $before[3]], $afterReview);
            $this->postJson('/api/v1/feedback/'.$row['id'].'/review', ['expected_revision' => 0], ['Idempotency-Key' => $key])->assertOk();
            $this->assertSame($afterReview, $this->counts());
            $this->postJson('/api/v1/feedback/'.$row['id'].'/archive', ['expected_revision' => 1], ['Idempotency-Key' => $key.'-archive'])
                ->assertOk()->assertJsonPath('data.archived_by', $official->id)->assertJsonPath('data.revision', 2)->assertJsonPath('data.comment', $row['comment'])->assertJsonPath('data.rating', 4);
            $this->getJson('/api/v1/feedback?type=general')->assertOk()->assertJsonPath('meta.total', 0);
            $this->getJson('/api/v1/feedback?archive=all')->assertOk()->assertJsonPath('meta.total', 1);
            $this->getJson('/api/v1/feedback?archive=only')->assertOk()->assertJsonPath('meta.total', 1);
            $this->signIn($owner);
            $this->getJson('/api/v1/feedback')->assertOk()->assertJsonPath('data.0.comment', $row['comment']);
            $this->getJson('/api/v1/feedback?archive=all')->assertForbidden();
            $this->getJson('/api/v1/feedback/'.$row['id'])->assertOk()->assertJsonPath('data.rating', 4);
        }
    }

    public function test_http_denials_wrong_types_stale_revisions_and_forged_metadata_have_no_effects(): void
    {
        [$owner, $service, $row] = $this->submission();
        foreach (['review', 'archive'] as $action) {
            foreach (['resident', 'responder', 'rescuer', 'foreign'] as $role) {
                $user = $role === 'resident' ? $owner : $this->sourceUser($role === 'foreign' ? 'captain' : $role, $role === 'foreign' ? null : $owner->barangay_id);
                $this->signIn($user);
                $before = $this->counts();
                $response = $this->postJson('/api/v1/feedback/'.$row['id'].'/'.$action, ['expected_revision' => 0], ['Idempotency-Key' => 'denied-gf-'.$action]);
                $role === 'foreign' ? $response->assertNotFound() : $response->assertForbidden();
                $this->assertSame($before, $this->counts());
            }
        }
        $official = $this->sourceUser('secretary', $owner->barangay_id);
        $this->signIn($official);
        $before = $this->counts();
        $this->postJson('/api/v1/feedback/'.$row['id'].'/review', ['expected_revision' => 5], ['Idempotency-Key' => 'gf-stale-command'])->assertConflict();
        $this->postJson('/api/v1/feedback/'.$row['id'].'/review', ['expected_revision' => 0, 'reviewed_by' => $owner->id], ['Idempotency-Key' => 'gf-forged-command'])->assertUnprocessable();
        $this->postJson('/api/v1/feedback/'.$row['id'].'/review', ['expected_revision' => 0])->assertUnprocessable();
        $this->assertSame($before, $this->counts());
        foreach (['complaint', 'suggestion'] as $type) {
            $operational = $service->submitFeedback(app(ReferenceData::class)->actorFor($owner->id), ['type' => $type, 'category' => 'Safety', 'description' => 'Fictional operational feedback'], 'gf-wrong-type-'.$type);
            $before = $this->counts();
            foreach (['review', 'archive'] as $action) {
                $this->postJson('/api/v1/feedback/'.$operational['id'].'/'.$action, ['expected_revision' => 0], ['Idempotency-Key' => 'gf-wrong-'.$type.'-'.$action])->assertConflict()->assertJsonPath('code', 'INVALID_STATE');
            }
            $this->assertSame($before, $this->counts());
        }
    }

    public function test_actor_security_generation_is_rechecked_on_receipt_replay(): void
    {
        [$owner, $service, $row] = $this->submission();
        $official = $this->sourceUser('captain', $owner->barangay_id);
        $actor = app(ReferenceData::class)->actorFor($official->id);
        $service->reviewFeedback($actor, $row['id'], ['expected_revision' => 0], 'gf-security-replay');
        DB::table('users')->where('id', $official->id)->increment('auth_version');
        $before = $this->counts();
        try {
            $service->reviewFeedback($actor, $row['id'], ['expected_revision' => 0], 'gf-security-replay');
            $this->fail('Revoked observation replayed a receipt.');
        } catch (Problem|ApiProblem $error) {
            $this->assertContains($error->errorCode, ['AUTH', 'FORBIDDEN', 'CONFLICT']);
        }
        $this->assertSame($before, $this->counts());
    }

    public function test_real_audit_failure_rolls_back_markers_revision_and_receipt(): void
    {
        [$owner, $service, $row] = $this->submission();
        $official = $this->sourceUser('captain', $owner->barangay_id);
        $actor = app(ReferenceData::class)->actorFor($official->id);
        $before = $this->counts();
        $inject = true;
        DB::listen(function (QueryExecuted $query) use (&$inject) {
            if ($inject && str_starts_with(strtolower($query->sql), 'insert into `activity_logs`')) {
                throw new \RuntimeException('Injected real audit write failure');
            }
        });
        try {
            $service->archiveFeedback($actor, $row['id'], ['expected_revision' => 0], 'gf-rollback-command');
            $this->fail('Audit injection did not run.');
        } catch (\RuntimeException $error) {
            $this->assertSame('Injected real audit write failure', $error->getMessage());
        } finally {
            $inject = false;
        }
        $this->assertSame($before, $this->counts());
        $stored = DB::table('community_feedback')->find($row['id']);
        $this->assertNull($stored->archived_at);
        $this->assertSame(0, $stored->revision);
    }

    public function test_actual_general_command_has_no_new_person_locks_after_feedback_lock(): void
    {
        [$owner, $service, $row] = $this->submission();
        $official = $this->sourceUser('secretary', $owner->barangay_id);
        $actor = app(ReferenceData::class)->actorFor($official->id);
        $tracking = true;
        $sourceLocked = false;
        $held = [];
        $late = [];
        DB::listen(function (QueryExecuted $query) use (&$tracking, &$sourceLocked, &$held, &$late) {
            if (! $tracking || ! str_contains(strtolower($query->sql), 'for update')) {
                return;
            }
            if (str_contains($query->sql, 'from `community_feedback`')) {
                $sourceLocked = true;
            }
            if (str_contains($query->sql, 'from `users`')) {
                // The nested resource-only transaction also issues an empty
                // whereIn([]) read: WHERE 0 = 1 acquires no user rows.
                if (preg_match('/where\s+0\s*=\s*1\s/i', $query->sql)) {
                    return;
                }
                foreach (LockedUserIds::from($query->sql, $query->bindings) as $id) {
                    if ($sourceLocked && ! isset($held[$id])) {
                        $late[] = $id;
                    }
                    $held[$id] = true;
                }
            }
        });
        try {
            $service->reviewFeedback($actor, $row['id'], ['expected_revision' => 0], 'gf-lock-order-review');
            $service->archiveFeedback($actor, $row['id'], ['expected_revision' => 1], 'gf-lock-order-archive');
        } finally {
            $tracking = false;
        }
        $this->assertTrue($sourceLocked);
        $this->assertSame([], $late);
    }

    public function test_independent_mysql_processes_serialize_competing_archive_and_review_and_same_intent(): void
    {
        [$owner, $service, $row] = $this->submission();
        $captain = $this->sourceUser('captain', $owner->barangay_id);
        $secretary = $this->sourceUser('secretary', $owner->barangay_id);
        $before = $this->counts();
        $results = $this->race([
            [$captain->id, $row['id'], 'review', 'gf-race-captain'],
            [$secretary->id, $row['id'], 'archive', 'gf-race-secretary'],
        ]);
        $this->assertSame(1, count(array_filter($results, fn ($r) => isset($r['id']))));
        $this->assertSame(1, count(array_filter($results, fn ($r) => ($r['error'] ?? null) === 'CONFLICT')));
        $this->assertSame([$before[0] + 1, $before[1] + 1, $before[2], $before[3]], $this->counts());
        $this->assertSame(1, DB::table('community_feedback')->where('id', $row['id'])->value('revision'));

        $second = $service->submitFeedback(app(ReferenceData::class)->actorFor($owner->id), ['type' => 'general', 'rating' => 5, 'comment' => 'Same intent race'], 'gf-race-new-submission');
        $before = $this->counts();
        $results = $this->race(array_fill(0, 2, [$captain->id, $second['id'], 'review', 'gf-race-identical-intent']));
        $this->assertSame([$second['id'], $second['id']], array_column($results, 'id'));
        $this->assertSame([$before[0] + 1, $before[1] + 1, $before[2], $before[3]], $this->counts());
    }

    private function race(array $jobs): array
    {
        $barrier = tempnam(sys_get_temp_dir(), 'gf-domain-');
        unlink($barrier);
        $workers = [];
        try {
            foreach ($jobs as $index => [$actor, $id, $action, $key]) {
                $ready = $barrier.'.'.$index;
                $process = proc_open([PHP_BINARY, base_path('tests/P2/general-feedback-worker.php'), (string) $actor, (string) $id, $action, $key, $barrier, $ready], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
                $this->assertIsResource($process);
                fclose($pipes[0]);
                $workers[] = [$process, $pipes, $ready];
            }
            $deadline = microtime(true) + 15;
            while (array_filter($workers, fn ($w) => ! is_file($w[2]))) {
                $this->assertLessThan($deadline, microtime(true), 'Worker readiness timed out');
                usleep(1000);
            }
            touch($barrier);
            $results = [];
            foreach ($workers as [$process, $pipes]) {
                stream_set_timeout($pipes[1], 15);
                $output = stream_get_contents($pipes[1]);
                $error = stream_get_contents($pipes[2]);
                $this->assertSame('', $error);
                $results[] = json_decode($output, true, flags: JSON_THROW_ON_ERROR);
            }

            return $results;
        } finally {
            foreach ($workers as [$process, $pipes, $ready]) {
                foreach ($pipes as $pipe) {
                    if (is_resource($pipe)) {
                        fclose($pipe);
                    }
                }
                if (proc_get_status($process)['running']) {
                    proc_terminate($process);
                }
                proc_close($process);
                if (is_file($ready)) {
                    unlink($ready);
                }
            }
            if (is_file($barrier)) {
                unlink($barrier);
            }
        }
    }
}

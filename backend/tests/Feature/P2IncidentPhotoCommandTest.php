<?php

namespace Tests\Feature;

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Models\CapacityGuard;
use App\Models\Verification;
use App\Providers\IntegrationServiceProvider;
use App\Services\Audit\AuditRecorder;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\SourceReferences;
use App\Services\Incidents\IncidentService;
use App\Services\Messaging\OutboxWriter;
use App\Services\P2\Actor;
use App\Services\P2\Persistence\IncidentPhotoPolicy;
use App\Services\P2\Problem;
use App\Services\Photos\PhotoInspector;
use App\Services\Photos\PrivateIncidentPhotos;
use App\Services\Photos\PrivatePhotoObjects;
use App\Support\ApiProblem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

/** Actual P1 bytes + P2 source command + DBA metadata on the same MySQL connection. */
final class P2IncidentPhotoCommandTest extends TestCase
{
    use CombinedMysql;

    private IncidentService $service;

    private PrivateIncidentPhotos $photos;

    private Actor $actor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        config(['integration.test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
        $this->photos = new PrivateIncidentPhotos(app(Store::class), app(IncidentPhotoPolicy::class), new IdentityReferences,
            new SourceReferences, new PhotoInspector, new PrivatePhotoObjects);
        $user = $this->sourceUser();
        Verification::forceCreate(['resident_id' => $user->id, 'barangay_id' => $user->barangay_id, 'review_status' => 'Approved']);
        $identity = EffectiveIdentity::fromUser($user);
        $this->actor = new Actor($identity->id, $identity->barangayId, $identity->role, $identity);
        $this->service = new IncidentService(app(Store::class), app(ReferenceData::class), app(AuditRecorder::class),
            app(OutboxWriter::class), static fn () => gmdate('Y-m-d\TH:i:s\Z'), $this->photos);
    }

    private function token(string $key): string
    {
        $image = imagecreatetruecolor(4, 4);
        ob_start();
        imagepng($image);
        $bytes = ob_get_clean();

        return $this->photos->stage($this->actor->observedIdentity(), UploadedFile::fake()->createWithContent('fictional.png', $bytes), $key)->uploadId;
    }

    private function source(): array
    {
        return $this->service->create($this->actor, [], 'photo-source-'.bin2hex(random_bytes(8)));
    }

    public function test_attachment_only_command_advances_revision_once_and_successful_lost_reply_replays(): void
    {
        $source = $this->source();
        $token = $this->token('command-photo-'.bin2hex(random_bytes(8)));
        $input = ['upload_ids' => [$token], 'expected_revision' => 0];
        $before = DB::table('activity_logs')->where('resource_type', 'alert')->where('resource_id', $source['id'])->count();
        $result = $this->service->details($this->actor, $source['id'], $input, 'attachment-command');
        $this->assertSame(1, $result['assignment_revision']);
        $row = DB::table('incident_photos')->where('upload_id', $token)->first();
        $this->assertSame('attached', $row->state);
        $this->assertSame($source['id'], (int) $row->incident_id);
        $this->assertSame('image/png', $this->photos->download($this->actor->observedIdentity(), $row->id)->headers->get('Content-Type'));
        $replay = $this->service->details($this->actor, $source['id'], $input, 'attachment-command');
        $this->assertSame(1, $replay['assignment_revision']);
        $this->assertSame($before + 1, DB::table('activity_logs')->where('resource_type', 'alert')->where('resource_id', $source['id'])->count());
        $this->assertSame(1, DB::table('idempotency_requests')->where('actor_id', $this->actor->id)->where('route', 'alerts.'.$source['id'].'.details')->count());
        $nearby = json_encode($this->service->nearby($this->actor), JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString($token, $nearby);
        $this->assertStringNotContainsString($row->object_key, $nearby);
    }

    public function test_failed_multi_token_command_rolls_back_metadata_source_audit_and_outcome(): void
    {
        $source = $this->source();
        $token = $this->token('rollback-photo-'.bin2hex(random_bytes(8)));
        $before = DB::table('activity_logs')->count();
        try {
            $this->service->details($this->actor, $source['id'], ['description' => 'Must roll back', 'upload_ids' => [$token, '11111111-1111-4111-8111-111111111111'], 'expected_revision' => 0], 'failed-photo-command');
            $this->fail('Unknown second token was accepted.');
        } catch (Problem $error) {
            $this->assertSame('NOT_FOUND', $error->errorCode);
        }
        $this->assertSame('ready', DB::table('incident_photos')->where('upload_id', $token)->value('state'));
        $this->assertSame(0, $this->service->get($this->actor, $source['id'])['assignment_revision']);
        $this->assertSame($before, DB::table('activity_logs')->count());
        $this->assertSame(0, DB::table('idempotency_requests')->where('actor_id', $this->actor->id)->where('route', 'alerts.'.$source['id'].'.details')->count());
        // Proves the ready token remains consumable by the actual command after rollback.
        $this->assertSame(1, $this->service->details($this->actor, $source['id'], ['upload_ids' => [$token], 'expected_revision' => 0], 'retry-valid-photo')['assignment_revision']);
    }

    public function test_tokens_lock_by_metadata_id_before_source_increment_and_changed_body_or_stale_new_intent_denies(): void
    {
        $source = $this->source();
        $first = $this->token('order-first-'.bin2hex(random_bytes(8)));
        $second = $this->token('order-second-'.bin2hex(random_bytes(8)));
        $queries = [];
        DB::listen(function ($query) use (&$queries): void {
            if (str_contains($query->sql, 'incident_photos') && str_contains($query->sql, 'for update')) {
                $queries[] = $query->bindings;
            }
        });
        $input = ['upload_ids' => [$second, $first], 'expected_revision' => 0];
        $this->service->details($this->actor, $source['id'], $input, 'ordered-photos');
        $locked = array_values(array_filter(array_merge(...$queries), fn ($value) => in_array($value, [$first, $second], true)));
        $this->assertSame([$first, $second], $locked);
        foreach ([['ordered-photos', ['upload_ids' => [$first], 'expected_revision' => 0]], ['stale-new-photo', $input]] as [$key, $body]) {
            try {
                $this->service->details($this->actor, $source['id'], $body, $key);
                $this->fail('Changed or stale photo command was accepted.');
            } catch (Problem $error) {
                $this->assertSame('CONFLICT', $error->errorCode);
            }
        }
        $this->assertSame(1, $this->service->get($this->actor, $source['id'])['assignment_revision']);
    }

    public function test_independent_actual_commands_with_opposite_token_order_commit_one_revision(): void
    {
        $source = $this->source();
        $tokens = [$this->token('process-first-'.bin2hex(random_bytes(8))), $this->token('process-second-'.bin2hex(random_bytes(8)))];
        $processes = [];
        DB::beginTransaction();
        try {
            CapacityGuard::lockPeople([$this->actor->id]);
            foreach ([$tokens, array_reverse($tokens)] as $index => $ordered) {
                $process = new Process([PHP_BINARY, base_path('tests/P2/photo-command-worker.php')], base_path());
                $process->setInput(json_encode(['user_id' => $this->actor->id, 'observed' => $this->actor->observedIdentity()->sessionSnapshot(),
                    'incident_id' => $source['id'], 'upload_ids' => $ordered, 'expected_revision' => 0, 'intent' => 'process-photo-'.$index], JSON_THROW_ON_ERROR))
                    ->setTimeout(25)->start();
                $processes[] = $process;
                $deadline = microtime(true) + 10;
                while (! str_contains($process->getOutput(), "ready\n") && $process->isRunning() && microtime(true) < $deadline) {
                    usleep(20000);
                }
                $this->assertStringContainsString("ready\n", $process->getOutput(), $process->getErrorOutput());
            }
            $this->assertTrue($processes[0]->isRunning() && $processes[1]->isRunning());
        } finally {
            DB::commit();
        }
        $results = [];
        foreach ($processes as $process) {
            $process->wait();
            $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());
            $results[] = json_decode(substr($process->getOutput(), strlen("ready\n")), true, flags: JSON_THROW_ON_ERROR);
        }
        $this->assertCount(1, array_filter($results, fn ($result) => $result['ok']));
        $this->assertCount(1, array_filter($results, fn ($result) => ! $result['ok'] && $result['code'] === 'CONFLICT'));
        $this->assertSame(1, $this->service->get($this->actor, $source['id'])['assignment_revision']);
        $this->assertSame(2, DB::table('incident_photos')->where('incident_id', $source['id'])->where('state', 'attached')->count());
    }

    public function test_caller_exception_rolls_back_actual_photo_command_then_original_intent_can_retry(): void
    {
        $source = $this->source();
        $token = $this->token('caller-photo-'.bin2hex(random_bytes(8)));
        $body = ['upload_ids' => [$token], 'expected_revision' => 0];
        $before = DB::table('activity_logs')->count();
        try {
            app(Store::class)->transaction(['person:'.$this->actor->id, 'incident:'.$source['id']], function () use ($source, $body): void {
                $this->assertSame(1, $this->service->details($this->actor, $source['id'], $body, 'caller-photo-command')['assignment_revision']);
                throw new \RuntimeException('injected caller exception');
            });
        } catch (\RuntimeException $error) {
            $this->assertSame('injected caller exception', $error->getMessage());
        }
        $this->assertSame('ready', DB::table('incident_photos')->where('upload_id', $token)->value('state'));
        $this->assertSame($before, DB::table('activity_logs')->count());
        $this->assertSame(0, $this->service->get($this->actor, $source['id'])['assignment_revision']);
        $this->assertSame(1, $this->service->details($this->actor, $source['id'], $body, 'caller-photo-command')['assignment_revision']);
    }

    public function test_successful_photo_replay_rejects_revoked_original_generation(): void
    {
        $source = $this->source();
        $token = $this->token('revoked-photo-'.bin2hex(random_bytes(8)));
        $input = ['upload_ids' => [$token], 'expected_revision' => 0];
        $this->service->details($this->actor, $source['id'], $input, 'generation-photo-command');
        DB::table('users')->where('id', $this->actor->id)->increment('auth_version');
        $this->expectException(ApiProblem::class);
        $this->service->details($this->actor, $source['id'], $input, 'generation-photo-command');
    }
}

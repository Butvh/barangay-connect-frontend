<?php

namespace Tests\Feature;

use App\Contracts\P2\Store;
use App\Contracts\Photos\IncidentPhotos;
use App\Models\CapacityGuard;
use App\Models\Verification;
use App\Providers\IntegrationServiceProvider;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\SourceReferences;
use App\Services\Incidents\IncidentService;
use App\Services\P2\Actor;
use App\Services\P2\Persistence\IncidentPhotoPolicy;
use App\Services\P2\Problem;
use App\Services\Photos\PhotoCleanup;
use App\Services\Photos\PhotoInspector;
use App\Services\Photos\PhotoStored;
use App\Services\Photos\PrivateIncidentPhotos;
use App\Services\Photos\PrivatePhotoObjects;
use App\Support\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class CombinedPrivatePhotoTest extends TestCase
{
    use CombinedMysql;

    private PrivateIncidentPhotos $photos;

    private Store $store;

    private PrivatePhotoObjects $objects;

    private $user;

    private EffectiveIdentity $observed;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        config(['integration.test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
        config(['filesystems.disks.private_incident_photos.root' => storage_path('app/private/incident-photo-objects')]);
        $this->store = app(Store::class);
        $this->objects = new PrivatePhotoObjects;
        $this->photos = new PrivateIncidentPhotos($this->store, app(IncidentPhotoPolicy::class), new IdentityReferences,
            new SourceReferences, new PhotoInspector, $this->objects);
        $this->user = $this->sourceUser();
        Verification::forceCreate(['resident_id' => $this->user->id, 'barangay_id' => $this->user->barangay_id, 'review_status' => 'Approved']);
        $this->observed = EffectiveIdentity::fromUser($this->user);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function bytes(string $format = 'png'): string
    {
        $image = imagecreatetruecolor(4, 4);
        ob_start();
        $format === 'png' ? imagepng($image) : imagejpeg($image);

        return ob_get_clean();
    }

    private function file(?string $bytes = null, string $name = 'fixture.png'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, $bytes ?? $this->bytes());
    }

    private function actor(?EffectiveIdentity $identity = null): Actor
    {
        $identity ??= $this->observed;

        return new Actor($identity->id, $identity->barangayId, $identity->role, $identity);
    }

    private function incident(): array
    {
        return app(IncidentService::class)->create($this->actor(), [], 'photo-sos-'.bin2hex(random_bytes(8)));
    }

    private function attach(string $token, array $incident): int
    {
        return $this->store->transaction(['person:'.$this->observed->id, 'incident:'.$incident['id']],
            fn () => $this->photos->attach($this->observed, $token, $incident['id'], $incident['assignment_revision']));
    }

    public function test_real_bytes_normalize_and_original_input_replay_preserves_one_immutable_token(): void
    {
        $input = $this->bytes().'private-location-marker';
        $first = $this->photos->stage($this->observed, $this->file($input), 'same-original-intent');
        $second = $this->photos->stage($this->observed, $this->file($input, 'renamed.jpg'), 'same-original-intent');
        $this->assertSame($first->uploadId, $second->uploadId);
        $row = DB::table('incident_photos')->where('upload_id', $first->uploadId)->first();
        $this->assertSame(hash('sha256', $input), $row->input_sha256);
        $this->assertNotSame($row->input_sha256, $row->sha256);
        $this->assertStringNotContainsString('private-location-marker', file_get_contents($this->objects->verified($row)));
        $this->assertCount(4, $first->toArray());
        $this->expectException(ApiProblem::class);
        $this->photos->stage($this->observed, $this->file($this->bytes().'different ancillary bytes'), 'same-original-intent');
    }

    public function test_jpeg_actual_type_is_detected_without_trusting_client_name(): void
    {
        $receipt = $this->photos->stage($this->observed, $this->file($this->bytes('jpeg'), 'not-authority.png'), 'jpeg-intent');
        $this->assertSame('image/jpeg', $receipt->mime);
    }

    public function test_attach_and_actual_source_write_rollback_together_without_touching_bytes(): void
    {
        $receipt = $this->photos->stage($this->observed, $this->file(), 'rollback-intent');
        $incident = $this->incident();
        try {
            $this->store->transaction(['person:'.$this->observed->id, 'incident:'.$incident['id']], function () use ($receipt, $incident): void {
                $this->photos->attach($this->observed, $receipt->uploadId, $incident['id'], 0);
                app(IncidentService::class)->details($this->actor(), $incident['id'], ['description' => 'Real joint write', 'expected_revision' => 0], 'photo-details-intent');
                throw new \RuntimeException('caller rollback');
            });
        } catch (\RuntimeException $error) {
            $this->assertSame('caller rollback', $error->getMessage());
        }
        $row = DB::table('incident_photos')->where('upload_id', $receipt->uploadId)->first();
        $this->assertSame('ready', $row->state);
        $this->assertSame(0, DB::table('emergency_alerts')->where('id', $incident['id'])->value('assignment_revision'));
        $this->assertFileExists($this->objects->verified($row));
        $this->attach($receipt->uploadId, $incident);
        $this->assertSame('attached', DB::table('incident_photos')->where('id', $row->id)->value('state'));
    }

    public function test_http_receipt_download_headers_and_foreign_token_denial_use_real_services(): void
    {
        $this->app->instance(IncidentPhotos::class, $this->photos); // Actual implementation + actual P2 policy, no double.
        $this->actingAs($this->user)->withSession($this->observed->sessionSnapshot());
        $data = $this->withHeader('Idempotency-Key', 'http-photo-intent')->post('/api/v1/incident-photos', ['photo' => $this->file()])
            ->assertCreated()->assertJsonMissingPath('data.object_key')->json('data');
        $incident = $this->incident();
        $id = $this->attach($data['upload_id'], $incident);
        $response = $this->get('/api/v1/incident-photos/'.$id.'/download')->assertOk();
        $response->assertHeader('X-Content-Type-Options', 'nosniff')->assertHeader('Content-Type', 'image/png');
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
        $other = $this->sourceUser('resident', $this->user->barangay_id);
        $this->actingAs($other)->withSession(EffectiveIdentity::fromUser($other)->sessionSnapshot());
        $this->get('/api/v1/incident-photos/'.$id.'/download')->assertNotFound();
    }

    public function test_wrong_scope_owner_generation_and_unrecorded_token_cannot_attach(): void
    {
        $receipt = $this->photos->stage($this->observed, $this->file(), 'generation-intent');
        $incident = $this->incident();
        DB::table('users')->where('id', $this->user->id)->increment('auth_version');
        $this->expectException(ApiProblem::class);
        $this->attach($receipt->uploadId, $incident);
    }

    public function test_actual_manual_assignment_and_transfer_change_private_byte_download_access(): void
    {
        $receipt = $this->photos->stage($this->observed, $this->file(), 'assigned-download-intent');
        $incident = $this->incident();
        $id = $this->attach($receipt->uploadId, $incident);
        $captain = EffectiveIdentity::fromUser($this->sourceUser('captain', $this->user->barangay_id));
        $old = EffectiveIdentity::fromUser($this->sourceUser('responder', $this->user->barangay_id));
        $next = EffectiveIdentity::fromUser($this->sourceUser('responder', $this->user->barangay_id));
        $service = app(IncidentService::class);
        $assigned = $service->assign($this->actor($captain), $incident['id'], ['personnel_id' => $old->id, 'expected_revision' => 0], true);
        $this->assertSame('image/png', $this->photos->download($old, $id)->headers->get('Content-Type'));
        $assignment = (int) DB::table('alert_assignments')->where('alert_id', $incident['id'])->where('status', 'active')->value('id');
        $service->changeAssignment($this->actor($captain), $assignment, ['personnel_id' => $next->id, 'reason' => 'Fictional shift transfer', 'expected_revision' => $assigned['assignment_revision']], true);
        $this->assertSame('image/png', $this->photos->download($next, $id)->headers->get('Content-Type'));
        try {
            $this->photos->download($old, $id);
            $this->fail('Transferred operator retained byte access.');
        } catch (Problem $error) {
            $this->assertSame('NOT_FOUND', $error->errorCode);
        }
        $current = $service->get($this->actor($captain), $incident['id']);
        $response = $service->response($this->actor($next), $incident['id'], ['response_type' => 'Assessment', 'response_status' => 'Completed',
            'rescue_required' => false, 'expected_revision' => $current['assignment_revision']], 'photo-resolved-response');
        $service->resolve($this->actor($captain), $incident['id'], ['expected_revision' => $response['assignment_revision']]);
        $this->assertSame('image/png', $this->photos->download($this->observed, $id)->headers->get('Content-Type'));
        $this->assertSame('image/png', $this->photos->download($captain, $id)->headers->get('Content-Type'));
        try {
            $this->photos->download($next, $id);
            $this->fail('Resolved source retained operator byte access.');
        } catch (Problem $error) {
            $this->assertSame('NOT_FOUND', $error->errorCode);
        }
    }

    public function test_corrupted_private_object_is_not_served_and_wrong_token_does_not_mutate(): void
    {
        $receipt = $this->photos->stage($this->observed, $this->file(), 'integrity-intent');
        $incident = $this->incident();
        try {
            $this->attach((string) Str::uuid(), $incident);
            $this->fail('Unknown token attached.');
        } catch (ApiProblem $error) {
            $this->assertSame('PHOTO_NOT_FOUND', $error->errorCode);
        }
        $id = $this->attach($receipt->uploadId, $incident);
        $row = DB::table('incident_photos')->where('id', $id)->first();
        file_put_contents($this->objects->path($row->object_key), 'tampered');
        $this->expectException(ApiProblem::class);
        $this->photos->download($this->observed, $id);
    }

    public function test_http_rejects_filename_only_unknown_fields_and_invalid_image_bytes(): void
    {
        $this->app->instance(IncidentPhotos::class, $this->photos);
        $this->actingAs($this->user)->withSession($this->observed->sessionSnapshot());
        $this->withHeader('Idempotency-Key', 'filename-only-intent')->postJson('/api/v1/incident-photos', ['photo' => 'filename.png'])->assertUnprocessable();
        $this->withHeader('Idempotency-Key', 'unknown-owner-intent')->post('/api/v1/incident-photos', ['photo' => $this->file(), 'owner_id' => $this->user->id])->assertUnprocessable();
        $this->withHeader('Idempotency-Key', 'spoofed-image-intent')->post('/api/v1/incident-photos', ['photo' => $this->file('<?php echo "fake";')])->assertUnprocessable()->assertJsonPath('code', 'PHOTO_INVALID');
        $this->assertSame(1, DB::table('incident_photos')->where('uploader_id', $this->user->id)->where('state', 'failed')->count());
    }

    public function test_processing_orphan_retries_do_not_allocate_or_return_ready(): void
    {
        Event::listen(PhotoStored::class, function (): never {
            throw new \RuntimeException('injected crash after actual immutable storage');
        });
        try {
            $this->photos->stage($this->observed, $this->file(), 'orphan-intent');
            $this->fail('Crash injection did not execute.');
        } catch (\RuntimeException $error) {
            $this->assertSame('injected crash after actual immutable storage', $error->getMessage());
        } finally {
            Event::forget(PhotoStored::class);
        }
        $row = DB::table('incident_photos')->where('uploader_id', $this->observed->id)->first();
        $this->assertSame('processing', $row->state);
        $this->assertFileExists($this->objects->path($row->object_key));
        $before = DB::table('incident_photos')->where('uploader_id', $this->observed->id)->count();
        try {
            $this->photos->stage($this->observed, $this->file(), 'orphan-intent');
            $this->fail('Processing cannot return a ready receipt.');
        } catch (ApiProblem $error) {
            $this->assertSame('PHOTO_PROCESSING', $error->errorCode);
        }
        $this->assertSame($before, DB::table('incident_photos')->where('uploader_id', $this->observed->id)->count());
        CarbonImmutable::setTestNow(CarbonImmutable::now('UTC')->addHours(25));
        $result = (new PhotoCleanup($this->objects))->run(100);
        $this->assertGreaterThanOrEqual(1, $result['removed']);
        $this->assertSame('removed', DB::table('incident_photos')->where('id', $row->id)->value('state'));
        $this->assertFileDoesNotExist($this->objects->path($row->object_key));
    }

    public function test_cleanup_fences_crash_recovery_and_attached_retention(): void
    {
        $ready = $this->photos->stage($this->observed, $this->file(), 'cleanup-ready-intent');
        $attached = $this->photos->stage($this->observed, $this->file(), 'cleanup-attached-intent');
        $attachedId = $this->attach($attached->uploadId, $this->incident());
        $id = (int) DB::table('incident_photos')->where('upload_id', $ready->uploadId)->value('id');
        CarbonImmutable::setTestNow(CarbonImmutable::now('UTC')->addHours(25));
        $cleanup = new PhotoCleanup($this->objects);
        $claim = $cleanup->claim($id);
        $this->assertNotNull($claim);
        $this->assertNull($cleanup->claim($id));
        $this->assertNull($cleanup->claim($attachedId));
        $this->assertFalse($cleanup->finalize($id, 'wrong-fence', true));
        CarbonImmutable::setTestNow(CarbonImmutable::now('UTC')->addMinutes(6));
        $this->assertFalse($cleanup->finalize($id, $claim->cleanup_token, true));
        $next = $cleanup->claim($id);
        $this->assertNotSame($claim->cleanup_token, $next->cleanup_token);
        $this->objects->remove($next->object_key); // Outside SQL, as the real run method does.
        $this->assertTrue($cleanup->finalize($id, $next->cleanup_token, true));
        $this->assertSame('removed', DB::table('incident_photos')->where('id', $id)->value('state'));
        $this->assertFileExists($this->objects->verified(DB::table('incident_photos')->where('id', $attachedId)->first()));
    }

    private function worker(array $input): Process
    {
        $process = new Process([PHP_BINARY, base_path('tests/Support/private-photo-worker.php')], base_path());
        $process->setInput(json_encode($input, JSON_THROW_ON_ERROR))->setTimeout(20)->start();
        $deadline = microtime(true) + 10;
        while (! str_contains($process->getOutput(), "ready\n") && $process->isRunning() && microtime(true) < $deadline) {
            usleep(20000);
        }
        $this->assertStringContainsString("ready\n", $process->getOutput(), $process->getErrorOutput());

        return $process;
    }

    private function outcome(Process $process): array
    {
        $process->wait();
        $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());

        return json_decode(substr($process->getOutput(), strlen("ready\n")), true, flags: JSON_THROW_ON_ERROR);
    }

    public function test_two_independent_actual_consumers_commit_one_photo_and_one_source_revision(): void
    {
        $receipt = $this->photos->stage($this->observed, $this->file(), 'race-upload-intent');
        $incident = $this->incident();
        $input = ['mode' => 'attach', 'user_id' => $this->user->id, 'observed' => $this->observed->sessionSnapshot(),
            'incident_id' => $incident['id'], 'upload_id' => $receipt->uploadId, 'expected_revision' => 0];
        DB::beginTransaction();
        try {
            CapacityGuard::lockPeople([$this->user->id]);
            $first = $this->worker($input + ['intent' => 'race-first-intent']);
            $second = $this->worker($input + ['intent' => 'race-second-intent']);
            $this->assertTrue($first->isRunning() && $second->isRunning());
        } finally {
            DB::commit();
        }
        $results = [$this->outcome($first), $this->outcome($second)];
        $this->assertCount(1, array_filter($results, fn ($r) => $r['ok']));
        $this->assertCount(1, array_filter($results, fn ($r) => ! $r['ok'] && $r['code'] === 'CONFLICT'));
        $this->assertSame(1, DB::table('emergency_alerts')->where('id', $incident['id'])->value('assignment_revision'));
        $this->assertSame('attached', DB::table('incident_photos')->where('upload_id', $receipt->uploadId)->value('state'));
    }

    public function test_expiry_cleanup_contends_with_actual_attach_without_reversing_people_source_order(): void
    {
        $current = CarbonImmutable::now('UTC');
        CarbonImmutable::setTestNow($current->subDay()->addSeconds(2));
        $receipt = $this->photos->stage($this->observed, $this->file(), 'cleanup-race-intent');
        CarbonImmutable::setTestNow();
        $incident = $this->incident();
        $id = (int) DB::table('incident_photos')->where('upload_id', $receipt->uploadId)->value('id');
        DB::beginTransaction();
        try {
            DB::table('incident_photos')->where('id', $id)->lockForUpdate()->first();
            $attach = $this->worker(['mode' => 'attach', 'user_id' => $this->user->id, 'observed' => $this->observed->sessionSnapshot(),
                'incident_id' => $incident['id'], 'upload_id' => $receipt->uploadId, 'expected_revision' => 0, 'intent' => 'expired-race-details']);
            while (CarbonImmutable::now('UTC') <= $current->addSeconds(3)) {
                usleep(20000);
            }
            $cleanup = $this->worker(['mode' => 'cleanup', 'photo_id' => $id]);
            $this->assertTrue($attach->isRunning() && $cleanup->isRunning());
        } finally {
            DB::commit();
        }
        $this->assertSame('PHOTO_NOT_FOUND', $this->outcome($attach)['code']);
        $this->assertTrue($this->outcome($cleanup)['result']['finalized']);
        $this->assertSame('removed', DB::table('incident_photos')->where('id', $id)->value('state'));
        $this->assertSame(0, DB::table('emergency_alerts')->where('id', $incident['id'])->value('assignment_revision'));
    }
}

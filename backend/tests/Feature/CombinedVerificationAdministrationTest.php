<?php

namespace Tests\Feature;

use App\Providers\IntegrationServiceProvider;
use App\Services\Identity\EffectiveIdentity;
use App\Services\P2\Problem;
use App\Services\Verification\PrivateDocumentUploads;
use App\Services\Verification\VerificationAdministration;
use App\Support\ApiProblem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class CombinedVerificationAdministrationTest extends TestCase
{
    use CombinedMysql;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        config(['integration.test_bindings' => true, 'integration.admin_test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
    }

    public function test_private_bytes_are_inspected_hash_checked_and_never_exposed_as_a_public_key(): void
    {
        $documents = app(PrivateDocumentUploads::class);
        $stage = $documents->stage(UploadedFile::fake()->image('government-id.png', 24, 24), 10485760, 'valid_id');
        try {
            $this->assertSame('image/png', $stage['mime']);
            $this->assertGreaterThan(0, $stage['bytes']);
            $path = $documents->verified((object) $stage);
            $this->assertStringContainsString('app/private/document-objects', str_replace('\\', '/', $path));
            $this->assertSame(substr($stage['object_key'], -64), hash_file('sha256', $path));
        } finally {
            $documents->release($stage);
        }
        file_put_contents($path, 'tampered');
        $this->expectException(ApiProblem::class);
        $documents->verified((object) $stage);
    }

    public function test_metadata_or_disguised_bytes_cannot_become_a_private_document(): void
    {
        $this->expectException(ApiProblem::class);
        app(PrivateDocumentUploads::class)->stage(UploadedFile::fake()->createWithContent('id.png', 'not an image'), 10485760, 'valid_id');
    }

    public function test_source_failure_rolls_back_uploaded_document_associations_audit_and_receipts(): void
    {
        $user = $this->sourceUser();
        $actor = EffectiveIdentity::fromUser($user);
        // This current P2 revision deliberately denies the new P1 family. It is
        // the actual production adapter failure, never an injected substitute.
        try {
            app(VerificationAdministration::class)->submit($actor, null, ['document_type' => 'Valid ID and proof of residence'],
                UploadedFile::fake()->image('id.png'), UploadedFile::fake()->image('proof.png'), 'rollback-'.bin2hex(random_bytes(8)));
            // A future owner implementation turns this into positive acceptance.
            $this->assertSame(1, DB::table('verifications')->where('resident_id', $user->id)->count());
        } catch (Problem $error) {
            $this->assertSame('Source projection is awaiting owner integration.', $error->getMessage());
            $this->assertSame(0, DB::table('verifications')->where('resident_id', $user->id)->count());
            $this->assertSame(0, DB::table('documents')->where('uploader_id', $user->id)->count());
            $this->assertSame(0, DB::table('activity_logs')->where('actor_id', $user->id)->count());
            $this->assertSame(0, DB::table('idempotency_requests')->where('actor_id', $user->id)->count());
        }
    }

    public function test_actual_correction_replay_approval_and_private_historical_download(): void
    {
        $user = $this->sourceUser();
        $official = $this->sourceUser('secretary', $user->barangay_id);
        $outsider = $this->sourceUser();
        $actor = EffectiveIdentity::fromUser($user);
        $reviewer = EffectiveIdentity::fromUser($official);
        $service = app(VerificationAdministration::class);
        $id = UploadedFile::fake()->image('valid-id.png');
        $proof = UploadedFile::fake()->image('proof.png');
        $key = 'original-'.bin2hex(random_bytes(8));
        $input = ['document_type' => 'Valid ID and proof of residence'];
        $first = $service->submit($actor, null, $input, $id, $proof, $key);
        $retry = $service->submit($actor, null, $input, $id, $proof, $key);
        $this->assertSame($first['id'], $retry['id']);
        $this->assertSame(1, $retry['submission_number']);
        $this->assertCount(2, $retry['documents']);
        $this->assertArrayNotHasKey('object_key', $retry['documents'][0]);
        $correction = $service->review($reviewer, $first['id'], ['decision' => 'Resubmission requested', 'reason' => 'Upload the complete address page.', 'expected_revision' => $first['revision']]);
        $this->assertSame('Resubmission requested', $correction['review_status']);
        DB::table('verifications')->where('id', $first['id'])->update(['deadline_at' => now('UTC')->subDay()]);
        $this->assertSame(0, $service->expireOverdue($actor));
        $updated = $service->submit($actor, $first['id'], $input + ['expected_revision' => $correction['revision']], $id, $proof, 'corrected-'.bin2hex(random_bytes(8)));
        $this->assertSame(2, $updated['submission_number']);
        $approved = $service->review($reviewer, $first['id'], ['decision' => 'Approved', 'expected_revision' => $updated['revision']]);
        $this->assertSame('Approved', $approved['review_status']);
        $this->assertSame(['Submitted', 'Resubmission requested', 'Resubmitted', 'Approved'], array_column($approved['history'], 'action'));
        $this->assertSame('valid_id', $service->document($actor, $first['documents'][0]['id'])->kind);
        $this->expectException(ApiProblem::class);
        $service->document(EffectiveIdentity::fromUser($outsider), $first['documents'][0]['id']);
    }
}

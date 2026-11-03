<?php

namespace Tests\Database;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\MysqlDbaTestCase;

/** Executes an unratified candidate only on the explicitly disposable DBA database. */
class IncidentPhotoProposalTest extends MysqlDbaTestCase
{
    private $proposal;

    protected function setUp(): void
    {
        parent::setUp();
        $this->proposal = require __DIR__.'/../../database/proposals/incident-photo-metadata.php';
        DB::table('barangays')->insert([['id' => 1, 'name' => 'Fictional photo scope'], ['id' => 2, 'name' => 'Other fictional scope']]);
        DB::table('households')->insert([['id' => 1, 'barangay_id' => 1, 'address' => 'Fictional'], ['id' => 2, 'barangay_id' => 2, 'address' => 'Fictional']]);
        foreach ([15 => 1, 16 => 1, 105 => 2] as $id => $scope) {
            DB::table('users')->insert(['id' => $id, 'barangay_id' => $scope, 'household_id' => $scope, 'full_name' => 'Fictional photo uploader', 'email' => 'photo-'.$id.'@example.invalid', 'password' => 'unusable-fictional-only', 'is_resident' => true]);
            DB::table('emergency_alerts')->insert(['id' => $id, 'barangay_id' => $scope, 'resident_id' => $id, 'household_id' => $scope, 'alert_type' => 'Other', 'location_label' => 'Fictional', 'reported_at' => '2026-11-03 00:00:00']);
        }
        $this->proposal->up();
    }

    protected function tearDown(): void
    {
        try {
            if (isset($this->proposal) && Schema::hasTable('incident_photos')) {
                DB::table('incident_photos')->delete();
                $this->proposal->down();
            }
        } finally {
            parent::tearDown();
        }
    }

    private function ready(array $patch = []): array
    {
        return array_replace(['upload_id' => (string) Str::uuid(), 'barangay_id' => 1, 'uploader_id' => 15, 'uploader_auth_version' => 0,
            'intent_digest' => bin2hex(random_bytes(32)), 'disk' => 'private_incident_photos', 'object_key' => 'incident-photos/aa/'.bin2hex(random_bytes(32)),
            'mime' => 'image/jpeg', 'bytes' => 123, 'sha256' => str_repeat('a', 64), 'state' => 'ready', 'created_at' => '2026-11-03 00:00:00.000001',
            'uploaded_at' => '2026-11-03 00:00:00.000002', 'updated_at' => '2026-11-03 00:00:00.000002', 'expires_at' => '2026-11-04 00:00:00.000001'], $patch);
    }

    public function test_seeded_additive_proposal_preserves_existing_records_and_is_not_auto_discovered(): void
    {
        $this->assertSame(3, DB::table('emergency_alerts')->count());
        $this->assertSame(3, DB::table('users')->count());
        $this->assertCount(8, glob(__DIR__.'/../../database/migrations/*.php'));
        $this->assertSame('InnoDB', DB::selectOne("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='incident_photos'")->ENGINE);
        $this->assertSame(1, DB::selectOne("SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='incident_photos' AND INDEX_NAME='photo_expiry_scan' AND SEQ_IN_INDEX=1")->n);
    }

    #[DataProvider('invalidRows')]
    public function test_candidate_database_rejects_invalid_metadata(array $patch): void
    {
        $this->expectException(QueryException::class);
        DB::table('incident_photos')->insert($this->ready($patch));
    }

    public static function invalidRows(): array
    {
        return [
            'foreign uploader' => [['uploader_id' => 105]],
            'foreign incident' => [['state' => 'attached', 'incident_id' => 105, 'attached_at' => '2026-11-03 01:00:00']],
            'different resident incident' => [['state' => 'attached', 'incident_id' => 16, 'attached_at' => '2026-11-03 01:00:00']],
            'malformed token' => [['upload_id' => str_repeat('a', 32)]],
            'unsafe path' => [['object_key' => '../private/photo.jpg']],
            'public disk' => [['disk' => 'public']],
            'unsupported detected mime' => [['mime' => 'image/svg+xml']],
            'empty bytes' => [['bytes' => 0]],
            'oversize bytes' => [['bytes' => 10485761]],
            'invalid hash' => [['sha256' => str_repeat('z', 64)]],
            'negative captured generation' => [['uploader_auth_version' => -1]],
            'attached without incident' => [['state' => 'attached', 'attached_at' => '2026-11-03 01:00:00']],
            'ready with incident' => [['incident_id' => 15]],
            'expired attachment' => [['state' => 'attached', 'incident_id' => 15, 'attached_at' => '2026-11-04 01:00:00']],
            'invalid expiry' => [['expires_at' => '2026-11-02 00:00:00']],
            'overlong lifetime' => [['expires_at' => '2026-11-05 00:00:00']],
            'ready missing inspection' => [['mime' => null, 'bytes' => null, 'sha256' => null]],
            'removing without claim' => [['state' => 'removing']],
            'removed without outcome' => [['state' => 'removed']],
            'failed without diagnostic' => [['state' => 'failed']],
        ];
    }

    public function test_attachment_rollback_retains_ready_token_and_duplicate_intent_is_rejected(): void
    {
        $row = $this->ready();
        $id = DB::table('incident_photos')->insertGetId($row);
        DB::beginTransaction();
        DB::table('incident_photos')->where('id', $id)->lockForUpdate()->first();
        DB::table('incident_photos')->where('id', $id)->update(['state' => 'attached', 'incident_id' => 15, 'attached_at' => '2026-11-03 01:00:00']);
        DB::rollBack();
        $this->assertSame('ready', DB::table('incident_photos')->where('id', $id)->value('state'));
        $this->assertNull(DB::table('incident_photos')->where('id', $id)->value('incident_id'));
        $this->expectException(QueryException::class);
        DB::table('incident_photos')->insert(array_replace($row, ['upload_id' => (string) Str::uuid(), 'object_key' => 'incident-photos/bb/'.bin2hex(random_bytes(32))]));
    }

    public function test_downgrade_refuses_retained_metadata_then_empty_downgrade_and_forward_application_work(): void
    {
        DB::table('incident_photos')->insert($this->ready(['state' => 'attached', 'incident_id' => 15, 'attached_at' => '2026-11-03 01:00:00']));
        try {
            $this->proposal->down();
            $this->fail('Retained photo metadata must block destructive downgrade.');
        } catch (\LogicException $error) {
            $this->assertSame('incident_photo_metadata_retained', $error->getMessage());
        }
        $this->assertSame(1, DB::table('incident_photos')->count());
        DB::table('incident_photos')->delete();
        $this->proposal->down();
        $this->assertFalse(Schema::hasTable('incident_photos'));
        $this->proposal->up();
        $this->assertTrue(Schema::hasTable('incident_photos'));
        $this->assertSame(3, DB::table('emergency_alerts')->count());
    }
}

<?php

namespace Tests\Database;

use App\Models\Document;
use App\Models\Facility;
use App\Models\Household;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\MysqlDbaTestCase;

class ModelContractTest extends MysqlDbaTestCase
{
    public function test_memberships_relationships_and_secret_serialization(): void
    {
        $this->fixtures();
        $user = User::findOrFail(3);
        $this->assertTrue($user->is_resident);
        $this->assertNotNull($user->tanodMembership);
        $this->assertSame('responder', $user->appointment->role);
        $this->assertArrayNotHasKey('password', $user->toArray());
        $this->assertArrayNotHasKey('object_key', Document::firstOrFail()->toArray());
        $this->assertSame('Fictional Barangay 1', $user->barangay->name);
    }

    public function test_document_metadata_is_immutable_in_eloquent(): void
    {
        $this->fixtures();
        $doc = Document::firstOrFail();
        $this->expectException(\LogicException::class);
        $doc->forceFill(['original_name' => 'changed.pdf'])->save();
    }

    public function test_all_created_tables_use_innodb_and_database_uses_utf8mb4(): void
    {
        $engines = DB::select('SELECT DISTINCT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
        $this->assertSame(['InnoDB'], array_column($engines, 'ENGINE'));
        $charset = DB::selectOne('SELECT DEFAULT_CHARACTER_SET_NAME AS charset FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()');
        $this->assertSame('utf8mb4', $charset->charset);
    }

    public function test_factories_build_fictional_scoped_records_without_known_passwords(): void
    {
        $household = Household::factory()->create();
        $user = User::factory()->create(['barangay_id' => $household->barangay_id, 'household_id' => $household->id]);
        $facility = Facility::factory()->create(['managed_by_barangay_id' => $household->barangay_id]);
        $this->assertSame($household->id, $user->household->id);
        $this->assertSame($household->barangay_id, $facility->manager->id);
        $this->assertTrue(str_ends_with($user->email, '@example.invalid'));
        $this->assertFalse(password_verify('demo1234', $user->password));
    }
}

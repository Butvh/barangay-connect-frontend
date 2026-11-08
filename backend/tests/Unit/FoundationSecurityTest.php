<?php

namespace Tests\Unit;

use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class FoundationSecurityTest extends TestCase
{
    public function test_encryption_uses_only_the_public_test_fixture_key(): void
    {
        $this->assertTrue(hash_equals('base64:MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=', (string) config('app.key')));
    }

    public function test_hasher_does_not_truncate_after_72_bytes(): void
    {
        $password = str_repeat('Ab1', 40).'tail';
        $hash = Hash::make($password);
        $this->assertTrue(Hash::check($password, $hash));
        $this->assertFalse(Hash::check(substr($password, 0, 72).'different', $hash));
        $this->assertSame('argon2id', password_get_info($hash)['algoName']);
    }

    public function test_private_disk_has_no_public_url_or_symlink(): void
    {
        $disk = config('filesystems.disks.local');
        $this->assertSame(storage_path('app/private'), $disk['root']);
        $this->assertFalse($disk['serve']);
        $this->assertTrue($disk['throw']);
        $this->assertSame([], config('filesystems.links'));
        $this->assertArrayNotHasKey('public', config('filesystems.disks'));
        $this->assertTrue(config('queue.connections.database.after_commit'));
    }

    public function test_administration_and_local_mail_are_not_implicitly_enabled_and_mysql_instants_are_utc(): void
    {
        $this->assertFalse(config('integration.admin_test_bindings'));
        $this->assertFalse(config('identity.local_recovery_mail'));
        $this->assertSame('+00:00', config('database.connections.mysql.timezone'));
        $this->assertSame('mysql', config('queue.connections.p1-recovery.connection'));
        $this->assertFalse(config('queue.connections.p1-recovery.after_commit'));
    }
}

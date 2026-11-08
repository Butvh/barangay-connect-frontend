<?php

namespace Tests\Database;

use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\MysqlDbaTestCase;

class BackupRestoreCheckTest extends MysqlDbaTestCase
{
    public function test_encrypted_fictional_backup_restores_counts_fks_and_private_file_bytes(): void
    {
        $bin = getenv('MYSQL_TEST_BIN');
        if (! $bin) {
            $this->markTestSkipped('MYSQL_TEST_BIN must point to genuine MySQL client binaries.');
        }
        $this->fixtures();
        $dir = sys_get_temp_dir().'/bc-restore-'.bin2hex(random_bytes(8));
        mkdir($dir, 0700);
        $optionFile = $dir.'/client.cnf';
        // Random test password contains only hex; no shell or command-line secrets.
        file_put_contents($optionFile, "[client]\nhost=".getenv('DB_TEST_HOST')."\nport=".getenv('DB_TEST_PORT')."\nuser=".getenv('DB_TEST_USERNAME')."\npassword=".getenv('DB_TEST_PASSWORD')."\n");
        chmod($optionFile, 0600);
        $suffix = PHP_OS_FAMILY === 'Windows' ? '.exe' : '';
        try {
            $dump = new Process([$bin.'/mysqldump'.$suffix, '--defaults-extra-file='.$optionFile, '--single-transaction', '--no-tablespaces', '--set-gtid-purged=OFF', getenv('DB_TEST_DATABASE')]);
            $dump->mustRun();
            $bytes = "%PDF-1.4\nFictional private fixture.\n";
            $key = random_bytes(32);
            $iv = random_bytes(12);
            $tag = '';
            $ciphertext = openssl_encrypt(json_encode(['sql' => $dump->getOutput(), 'file' => base64_encode($bytes)], JSON_THROW_ON_ERROR), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
            file_put_contents($dir.'/backup.enc', $iv.$tag.$ciphertext);
            $saved = file_get_contents($dir.'/backup.enc');
            $restored = json_decode(openssl_decrypt(substr($saved, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($saved, 0, 12), substr($saved, 12, 16)), true, flags: JSON_THROW_ON_ERROR);
            $this->migrateDown();
            $restore = new Process([$bin.'/mysql'.$suffix, '--defaults-extra-file='.$optionFile, getenv('DB_TEST_DATABASE')]);
            $restore->setInput($restored['sql']);
            $restore->mustRun();
            $this->assertSame(40, DB::table('users')->count());
            $this->assertSame(10, DB::table('documents')->count());
            $this->assertSame(0, DB::table('alert_assignments as a')->leftJoin('emergency_alerts as e', 'a.alert_id', '=', 'e.id')->whereNull('e.id')->count());
            $this->assertSame($bytes, base64_decode($restored['file']));
            $this->assertStringNotContainsString('Fictional private fixture', $saved);
        } finally {
            foreach (glob($dir.'/*') as $file) {
                unlink($file);
            } rmdir($dir);
        }
    }
}

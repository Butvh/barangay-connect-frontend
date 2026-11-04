<?php

// Metadata protocol fixture, not a replacement P1 byte service or P2 command.
[$script, $barrier, $worker, $id, $mode] = $argv;
$database = getenv('DB_TEST_DATABASE');
if (getenv('DB_TEST_DISPOSABLE') !== '1' || ! str_starts_with($database, 'bc_dba_')) {
    throw new RuntimeException('Disposable photo database required.');
}
$db = new PDO('mysql:host='.getenv('DB_TEST_HOST').';port='.getenv('DB_TEST_PORT').';dbname='.$database,
    getenv('DB_TEST_USERNAME'), getenv('DB_TEST_PASSWORD'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$db->exec("SET time_zone='+00:00'");
touch($barrier.'/ready-'.$worker);
$deadline = microtime(true) + 10;
while (! is_file($barrier.'/go')) {
    if (microtime(true) > $deadline) {
        throw new RuntimeException('Photo barrier timeout.');
    }
    usleep(10000);
}
$db->beginTransaction();
try {
    if ($mode === 'attach') {
        $db->query('SELECT id FROM users WHERE id=15 FOR UPDATE')->fetch();
        $db->query('SELECT id FROM emergency_alerts WHERE id=15 FOR UPDATE')->fetch();
        $sql = "UPDATE incident_photos SET state='attached',incident_id=15,attached_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE id=? AND uploader_id=15 AND barangay_id=1 AND state='ready' AND expires_at>UTC_TIMESTAMP(6) AND cleanup_token IS NULL";
        $query = $db->prepare($sql);
        $query->execute([$id]);
        $result = $query->rowCount() === 1 ? 'attached' : 'conflict';
    } else {
        // Metadata only. No user/incident acquisition after this statement.
        $hex = bin2hex(random_bytes(16));
        $token = substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-4'.substr($hex, 13, 3).'-a'.substr($hex, 17, 3).'-'.substr($hex, 20);
        $query = $db->prepare("UPDATE incident_photos SET state='removing',cleanup_token=?,cleanup_lease_until=UTC_TIMESTAMP(6)+INTERVAL 5 MINUTE,cleanup_attempts=cleanup_attempts+1,updated_at=UTC_TIMESTAMP(6) WHERE id=? AND state IN ('processing','ready','failed') AND expires_at<=UTC_TIMESTAMP(6) AND cleanup_attempts<20");
        $query->execute([$token, $id]);
        $result = $query->rowCount() === 1 ? 'claimed' : 'conflict';
    }
    $db->commit();
    echo $result;
} catch (Throwable $error) {
    $db->rollBack();
    throw $error;
}

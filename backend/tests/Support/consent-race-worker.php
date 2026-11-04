<?php

// Independent SQL metadata/CAS fixture. Does not implement P1 authority or produce SMS.
[$script, $barrier, $worker, $mode] = $argv;
$database = getenv('DB_TEST_DATABASE');
if (getenv('DB_TEST_DISPOSABLE') !== '1' || ! str_starts_with($database, 'bc_dba_')) {
    throw new RuntimeException('Disposable consent database required.');
}
$db = new PDO('mysql:host='.getenv('DB_TEST_HOST').';port='.getenv('DB_TEST_PORT').';dbname='.$database,
    getenv('DB_TEST_USERNAME'), getenv('DB_TEST_PASSWORD'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$db->exec("SET time_zone='+00:00'");
touch($barrier.'/ready-'.$worker);
$deadline = microtime(true) + 10;
while (! is_file($barrier.'/go')) {
    if (microtime(true) > $deadline) {
        throw new RuntimeException('Consent barrier timeout.');
    }
    usleep(10000);
}
$db->beginTransaction();
try {
    $db->query('SELECT id FROM users WHERE id=15 FOR UPDATE')->fetch();
    if ($mode === 'create') {
        $db->exec("INSERT INTO notification_preferences (user_id,barangay_id,purpose,channel,state,revision,policy_version,template_version,recorded_by,granted_at,created_at,updated_at) VALUES (15,1,'incident_review','sms','granted',1,'sms-consent.v1','alert-review.v1',15,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))");
        $result = 'created';
    } else {
        $changed = $db->exec("UPDATE notification_preferences SET state='revoked',revision=2,revoked_at=UTC_TIMESTAMP(6),updated_at=UTC_TIMESTAMP(6) WHERE user_id=15 AND barangay_id=1 AND purpose='incident_review' AND channel='sms' AND revision=1");
        $result = $changed === 1 ? 'revoked' : 'conflict';
    }
    $db->commit();
    echo $result;
} catch (PDOException $error) {
    $db->rollBack();
    if ($error->getCode() === '23000' && (int) $error->errorInfo[1] === 1062) {
        echo 'conflict';
    } else {
        throw $error;
    }
}

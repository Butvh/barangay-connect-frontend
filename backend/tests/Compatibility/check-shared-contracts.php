<?php

use App\Services\Messaging\CreateInAppNotification;
use App\Services\Messaging\InAppNotificationHandler;
use App\Services\Messaging\OutboxWriter;

/** Deliberately separate acceptance gate, not a production adapter or an expected-green unit test. */
$autoload = getenv('DBA_TEST_AUTOLOAD');
if (! $autoload || ! is_file($autoload)) {
    throw new RuntimeException('Set the combined-checkout DBA_TEST_AUTOLOAD.');
}
require $autoload;
$failures = [];
$writer = OutboxWriter::class;
$handler = CreateInAppNotification::class;
$interface = InAppNotificationHandler::class;
if (! class_exists($writer)) {
    $failures[] = 'P2 transactional OutboxWriter is absent.';
} else {
    if (! is_subclass_of($writer, App\Contracts\Events\OutboxWriter::class)) {
        $failures[] = 'P2 writer does not implement the shared P1 OutboxWriter interface.';
    }
    $method = new ReflectionMethod($writer, 'record');
    if ((string) $method->getParameters()[5]->getType() !== DateTimeImmutable::class) {
        $failures[] = 'P2 occurredAt is not the shared DateTimeImmutable argument.';
    }
}
if (! class_exists($handler) || ! is_subclass_of($handler, $interface)) {
    $failures[] = 'P2 handler does not implement handle(OutboxEvent, OutboxRecipient): void.';
}
if (interface_exists(App\Contracts\Events\OutboxWriter::class)) {
    $p1 = new ReflectionMethod(App\Contracts\Events\OutboxWriter::class, 'record');
    if (count($p1->getParameters()) !== 7) {
        $failures[] = 'P1 OutboxWriter still needs the explicit optional bounded context argument.';
    }
}
$base = dirname(__DIR__, 2);
$support = $base.'/tests/P2/support.php';
if (is_file($support) && class_exists($writer)) {
    require $support; // P2-owned MemoryStore is a contract fake only; no SQL or production binding.
    $store = new MemoryStore;
    $actual = new $writer($store, static fn () => '2026-11-03T00:00:00Z');
    try {
        $store->transaction([], fn () => $actual->record('8c3f1c74-98ef-4f27-a462-48beb6df4620', 'incident.created.v2', 1, 1,
            [['user_id' => 1, 'audience' => 'official', 'in_app' => true, 'sms' => true]], '2026-11-03T00:00:00Z', ['status' => 'Pending']));
        $row = $store->select('outbox_events')[0] ?? [];
        if (($row['version'] ?? null) !== 2 || ($row['type'] ?? null) !== 'incident.created.v2') {
            $failures[] = 'P2 writer did not persist the canonical v2 fixture.';
        }
    } catch (Throwable) {
        $failures[] = 'P2 writer rejects the canonical UUID/v2/relational-recipient fixture.';
    }
}
foreach ($failures as $message) {
    echo 'BLOCKED: '.$message.PHP_EOL;
}
if ($failures) {
    exit(2);
}
echo "Shared writer/handler signatures and canonical fixture pass. Actual SQL/domain race acceptance remains separately required.\n";

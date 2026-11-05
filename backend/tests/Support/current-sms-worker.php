<?php

use App\Models\SmsDelivery;
use App\Models\User;
use App\Services\Identity\CurrentSmsConsent;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\SmsDeliveryEligibility;
use App\Services\Messaging\SmsDeliveryService;
use App\Services\P2\Persistence\RelationalStore;
use App\Services\P2\Persistence\TypedAuditRecorder;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

// Independent actual P1 authority and actual DBA worker; fictional fixture + fake HTTP only.
require getenv('DBA_TEST_AUTOLOAD') ?: dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
[$script, $mode, $barrier, $id] = $argv;
$db = DB::connection('mysql');
if (! $app->environment('testing') || getenv('DB_TEST_DISPOSABLE') !== '1'
    || ! str_starts_with($db->getDatabaseName(), 'bc_dba_') || $db->getDatabaseName() !== getenv('DB_TEST_DATABASE')) {
    throw new LogicException('Confirmed disposable current-worker fixture required.');
}
$db->statement("SET time_zone='+00:00'"); // Match the explicitly UTC parent test connection.
config(['identity.enabled' => true, 'integration.connection' => 'mysql', 'messaging.sms.enabled' => true,
    'messaging.sms.key' => 'fake-key', 'messaging.sms.sender' => 'Approved', 'messaging.sms.allowlist' => ['639171234567'],
    'messaging.sms.destination_pepper' => str_repeat('p', 32), 'messaging.sms.daily_segment_budget' => 10]);
$consent = new CurrentSmsConsent(new RelationalStore,
    new IdentityReferences, new TypedAuditRecorder);
$app->instance(SmsDeliveryEligibility::class, $consent);
$calls = 0;
Http::preventStrayRequests();
Http::fake(function () use (&$calls) {
    $calls++;

    return Http::response([['message_id' => 951, 'recipient' => '639171234567', 'status' => 'Queued']]);
});
if ($mode === 'revoke') {
    DB::listen(function ($event) use ($barrier) {
        if (str_starts_with(strtolower($event->sql), 'update '.chr(96).'notification_preferences'.chr(96))) {
            touch($barrier.'/revoke-held');
            $deadline = microtime(true) + 15;
            while (! is_file($barrier.'/release')) {
                if (microtime(true) > $deadline) {
                    throw new RuntimeException('Revocation barrier timeout.');
                }
                usleep(10000);
            }
        }
    });
    $identity = EffectiveIdentity::fromUser(User::findOrFail(1));
    $result = $consent->change($identity, 'incident_review', ['state' => 'revoked', 'expected_revision' => 1,
        'policy_version' => 'sms-consent.v1', 'template_version' => 'alert-review.v1']);
    echo json_encode(['state' => $result['state'], 'revision' => $result['revision'], 'provider_calls' => $calls], JSON_THROW_ON_ERROR);
} else {
    touch($barrier.'/sender-ready');
    $app->make(SmsDeliveryService::class)->send((int) $id);
    $delivery = SmsDelivery::findOrFail($id);
    echo json_encode(['state' => $delivery->state, 'error' => $delivery->last_error, 'provider_calls' => $calls], JSON_THROW_ON_ERROR);
}

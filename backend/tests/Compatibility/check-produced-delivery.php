<?php

/** Consume the ACTUAL P2 producer-fixture report. External HTTP is always fake. */
use App\Models\OutboxEvent;
use App\Models\SmsDelivery;
use App\Providers\IntegrationServiceProvider;
use App\Services\Identity\CurrentSmsConsent;
use App\Services\Identity\SmsDeliveryEligibility;
use App\Services\Messaging\OutboxDispatcher;
use App\Services\Messaging\SmsDeliveryService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Compatibility\ConfiguredAdapters;
use Tests\Compatibility\SqlContractProbe;

require getenv('DBA_TEST_AUTOLOAD') ?: dirname(__DIR__, 2).'/vendor/autoload.php';
$require = static function (bool $condition, string $code): void {
    if (! $condition) {
        throw new LogicException($code);
    }
};
try {
    $options = getopt('', ['fixture-report:']);
    $file = $options['fixture-report'] ?? '';
    $require(is_string($file) && is_file($file), 'actual_producer_report_required');
    $fixture = json_decode(file_get_contents($file), true, flags: JSON_THROW_ON_ERROR);
    $expectedSms = ['positive' => [1, 1], 'missing' => [0, 0], 'revoked' => [0, 0], 'wrong_purpose' => [0, 1]];
    $require(isset($expectedSms[$fixture['case'] ?? '']) && count($fixture['events'] ?? []) === 2, 'producer_mode_invalid');
    $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    (new SqlContractProbe($app))->assertDisposable();
    $require(app()->environment('testing') && DB::transactionLevel() === 0 && $fixture['database'] === DB::connection()->getDatabaseName()
        && ! config('messaging.sms.enabled') && ! config('messaging.make.enabled') && ! config('integration.dispatch_enabled'), 'fake_profile_required');
    $require(DB::selectOne('SELECT @@SESSION.time_zone AS tz')->tz === '+00:00', 'actual_p1_utc_connector_required');
    $require($fixture['delivery_invoked'] === false && $fixture['real_messages'] === 0, 'unexpected_producer_side_effect');
    config(['identity.enabled' => true, 'integration.test_bindings' => true, 'integration.consent_test_bindings' => true]);
    (new IntegrationServiceProvider($app))->register();
    $selection = (new ConfiguredAdapters($app))->resolve([]);
    $require($selection['diagnostics'] === [], 'configured_adapters_unavailable');
    $require(get_class(app(SmsDeliveryEligibility::class)) === CurrentSmsConsent::class, 'actual_consent_required');
    Http::preventStrayRequests();
    $posts = [];
    $currentEvent = null;
    $currentDelivery = null;
    Http::fake(function ($request) use (&$posts, &$currentEvent, &$currentDelivery, $require) {
        $require(DB::transactionLevel() === 0, 'provider_io_before_commit');
        $require($request->method() === 'POST' && $request->url() === 'https://api.semaphore.co/api/v4/messages', 'unexpected_external_target');
        $require(is_int($currentDelivery) && $currentDelivery > 0, 'fake_provider_delivery_reference_missing');
        $id = 85000 + $currentDelivery;
        $posts[] = ['event_id' => $currentEvent, 'fake_provider_id' => $id, 'after_commit' => true];

        return Http::response([['message_id' => $id, 'recipient' => '639171234567', 'status' => 'Queued']]);
    });
    config(['messaging.sms.enabled' => true, 'messaging.sms.key' => 'fake-key', 'messaging.sms.sender' => 'Approved',
        'messaging.sms.allowlist' => ['639171234567'], 'messaging.sms.destination_pepper' => str_repeat('p', 32),
        'messaging.sms.daily_segment_budget' => 100, 'messaging.make.command_token' => str_repeat('t', 40),
        'messaging.make.credential_id' => 'dba-produced-v1', 'messaging.make.barangay_id' => $fixture['scope']]);
    $results = [];
    $expectedNewPosts = 0;
    foreach ($fixture['events'] as $index => $source) {
        $require(Str::isUuid($source['event_id'] ?? '') && $source['type'] === ['incident.created.v2', 'announcement.published.v2'][$index], 'producer_event_reference_invalid');
        $event = OutboxEvent::where('event_id', $source['event_id'])->sole();
        $require($event->type === $source['type'] && $event->barangay_id === $fixture['scope'] && $event->resource_id === $source['resource_id'], 'producer_source_mismatch');
        $event->load('recipients');
        $expected = $expectedSms[$fixture['case']][$index];
        $require($event->recipients->where('in_app', true)->count() === [1, 2][$index] && $event->recipients->where('sms', true)->count() === $expected, 'source_channel_counts_changed');
        $require($source['in_app'] === [1, 2][$index] && $source['sms'] === $expected, 'fixture_channel_report_invalid');
        $currentEvent = $event->event_id;
        app(OutboxDispatcher::class)->dispatchOne($currentEvent);
        app(OutboxDispatcher::class)->dispatchOne($currentEvent);
        $require($event->fresh()->dispatched_at !== null && $event->fresh()->blocked_at === null, 'actual_in_app_dispatch_failed');
        $inApp = DB::table('delivery_receipts')->where('outbox_event_id', $event->id)->where('channel', 'in_app');
        $require((clone $inApp)->count() === [1, 2][$index] && (clone $inApp)->where('state', 'complete')->count() === [1, 2][$index], 'independent_in_app_receipts_incomplete');
        $deliveries = SmsDelivery::whereHas('receipt', fn ($q) => $q->where('outbox_event_id', $event->id))->get();
        $require($deliveries->count() === $expected, 'sms_intent_upgraded_or_missing');
        $proof = [];
        $make = null;
        foreach ($deliveries as $delivery) {
            $currentDelivery = (int) $delivery->id;
            $alreadyAccepted = $delivery->state === 'accepted';
            $expectedNewPosts += $alreadyAccepted ? 0 : 1;
            if ($index === 1) {
                $before = count($posts);
                app(SmsDeliveryService::class)->send($delivery->id);
                $require(count($posts) === $before && $delivery->fresh()->state === ($alreadyAccepted ? 'accepted' : 'pending'), 'make_command_was_not_required');
                config(['messaging.make.enabled' => true]); // In-process only, after fake/stray prevention.
                $payload = ['event_id' => $event->event_id, 'barangay_id' => $event->barangay_id, 'type' => $event->type,
                    'template_key' => $event->template_key, 'timestamp' => now()->timestamp];
                $kernel = $app->make(HttpKernel::class);
                foreach ([$alreadyAccepted, true] as $duplicate) {
                    $request = Request::create('/api/v1/integrations/make/sms-commands', 'POST', [], [], [],
                        ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer '.str_repeat('t', 40), 'HTTP_X_CREDENTIAL_ID' => 'dba-produced-v1'], json_encode($payload, JSON_THROW_ON_ERROR));
                    $response = $kernel->handle($request);
                    $require($response->getStatusCode() === 202, 'authenticated_make_command_failed');
                    $require(json_decode($response->getContent(), true)['data']['duplicate'] === $duplicate, 'make_command_replay_failed');
                    $kernel->terminate($request, $response);
                }
                $command = DB::table('make_commands')->where('outbox_event_id', $event->id)->sole();
                $hash = hash('sha256', json_encode([$event->event_id, $event->barangay_id, $event->type, $event->template_key], JSON_THROW_ON_ERROR));
                $require($command->credential_id === 'dba-produced-v1' && hash_equals($command->payload_hash, $hash), 'make_credential_or_payload_evidence_invalid');
                $make = ['authenticated_http' => true, 'replay_deduplicated' => true, 'credential_id' => $command->credential_id, 'payload_hash' => $command->payload_hash];
            }
            $before = count($posts);
            app(SmsDeliveryService::class)->send($delivery->id);
            app(SmsDeliveryService::class)->send($delivery->id);
            $require(count($posts) === $before + ($alreadyAccepted ? 0 : 1) && $delivery->fresh()->state === 'accepted' && $delivery->fresh()->attempts === 1, 'fake_delivery_not_once');
            $rows = DB::table('sms_authorizations')->where('sms_delivery_id', $delivery->id)->orderBy('id')->get(['gate', 'consent_revision', 'policy_version', 'template_version']);
            $require($rows->pluck('gate')->all() === ['reservation', 'pre_send'], 'actual_current_authority_proof_missing');
            $require(DB::table('sms_attempts')->where('sms_delivery_id', $delivery->id)->count() === 1, 'attempt_replay_failed');
            $proof[] = ['delivery_id' => $delivery->id, 'state' => 'accepted', 'attempts' => 1, 'completed_replay' => $alreadyAccepted, 'fake_provider_id' => $delivery->fresh()->provider_message_id, 'current_gates' => $rows->all()];
        }
        $require((clone $inApp)->where('state', 'complete')->count() === [1, 2][$index], 'sms_changed_in_app_receipts');
        $results[] = ['event_id' => $currentEvent, 'type' => $event->type, 'in_app_complete' => [1, 2][$index], 'sms_intents' => $expected, 'delivery_evidence' => $proof, 'make' => $make];
    }
    $require(count($posts) === $expectedNewPosts, 'fake_post_count_invalid');
    echo json_encode(['case' => $fixture['case'], 'database' => $fixture['database'], 'consumer_probe_sha256' => hash_file('sha256', __FILE__), 'producer_fixture_sha256' => hash_file('sha256', dirname(__DIR__).'/P2/producer-fixture.php'),
        'producer_report_sha256' => hash_file('sha256', $file), 'selected' => $selection['selected'], 'events' => $results,
        'fake_http_posts' => $posts, 'real_provider_calls' => 0, 'scenario_activated' => false, 'handset_delivery_tested' => false], JSON_THROW_ON_ERROR).PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, 'BLOCKED: produced_delivery_probe_failed ('.get_class($error).': '.$error->getMessage().')'.PHP_EOL);
    exit(2);
}

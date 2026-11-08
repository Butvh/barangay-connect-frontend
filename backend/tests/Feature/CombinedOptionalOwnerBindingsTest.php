<?php

namespace Tests\Feature;

use App\Contracts\Photos\IncidentPhotos;
use App\Models\Verification;
use App\Providers\IntegrationServiceProvider;
use App\Services\Identity\CurrentSmsConsent;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Incidents\IncidentService;
use App\Services\P2\Actor;
use App\Services\Photos\PrivateIncidentPhotos;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class CombinedOptionalOwnerBindingsTest extends TestCase
{
    use CombinedMysql;

    private function selected(bool $optional): void
    {
        $this->combinedMysql();
        config(['integration.test_bindings' => true, 'integration.photo_test_bindings' => $optional,
            'integration.consent_test_bindings' => $optional, 'integration.sms_intent_test_bindings' => $optional]);
        (new IntegrationServiceProvider($this->app))->register();
    }

    public function test_optional_ports_remain_unbound_and_photo_routes_unavailable_by_default(): void
    {
        $this->selected(false);
        $this->assertFalse($this->app->bound(IncidentPhotos::class));
        $user = $this->sourceUser();
        $this->actingAs($user)->withSession(EffectiveIdentity::fromUser($user)->sessionSnapshot())
            ->getJson('/api/v1/incident-photos/references/1')->assertStatus(503);
    }

    public function test_explicit_selection_attaches_real_bytes_and_reads_only_authorized_safe_metadata(): void
    {
        $this->selected(true);
        $owner = $this->sourceUser();
        Verification::forceCreate(['resident_id' => $owner->id, 'barangay_id' => $owner->barangay_id, 'review_status' => 'Approved']);
        $identity = EffectiveIdentity::fromUser($owner);
        $actor = new Actor($owner->id, $owner->barangay_id, 'resident', $identity);
        $photos = app(IncidentPhotos::class);
        $this->assertInstanceOf(PrivateIncidentPhotos::class, $photos);
        $source = app(IncidentService::class);
        $incident = $source->create($actor, [], 'optional-source-'.bin2hex(random_bytes(8)));
        $staged = $photos->stage($identity, UploadedFile::fake()->image('private-photo.png', 16, 16), 'optional-upload-'.bin2hex(random_bytes(8)));
        $source->details($actor, $incident['id'], ['expected_revision' => 0, 'upload_ids' => [$staged->uploadId]], 'optional-details-'.bin2hex(random_bytes(8)));
        $this->actingAs($owner)->withSession($identity->sessionSnapshot());
        $response = $this->getJson('/api/v1/incident-photos/references/'.$incident['id'])->assertOk();
        $metadata = $response->json('data');
        $this->assertCount(1, $metadata);
        $this->assertSame(['id', 'mime', 'bytes'], array_keys($metadata[0]));
        $this->assertSame('image/png', $metadata[0]['mime']);
        $this->assertStringNotContainsString($staged->uploadId, json_encode($metadata));
        $this->get('/api/v1/incident-photos/'.$metadata[0]['id'].'/download')->assertOk()->assertHeader('Content-Type', 'image/png');
        $foreign = $this->sourceUser('resident', $owner->barangay_id);
        $this->actingAs($foreign)->withSession(EffectiveIdentity::fromUser($foreign)->sessionSnapshot());
        $this->getJson('/api/v1/incident-photos/references/'.$incident['id'])->assertNotFound();
        $this->getJson('/api/v1/incident-photos/'.$metadata[0]['id'].'/download')->assertNotFound();
    }

    public function test_explicit_actual_consent_and_writer_selection_records_source_intent_without_delivery(): void
    {
        $this->selected(true);
        $resident = $this->sourceUser();
        $captain = $this->sourceUser('captain', $resident->barangay_id);
        Verification::forceCreate(['resident_id' => $resident->id, 'barangay_id' => $resident->barangay_id, 'review_status' => 'Approved']);
        app(CurrentSmsConsent::class)->change(EffectiveIdentity::fromUser($captain), 'incident_review',
            ['state' => 'granted', 'expected_revision' => 0, 'policy_version' => 'sms-consent.v1', 'template_version' => 'alert-review.v1']);
        $identity = EffectiveIdentity::fromUser($resident);
        $incident = app(IncidentService::class)->create(new Actor($resident->id, $resident->barangay_id, 'resident', $identity), [],
            'consented-source-'.bin2hex(random_bytes(8)));
        $event = DB::table('outbox_events')->where('type', 'incident.created.v2')->where('resource_id', $incident['id'])->sole();
        $this->assertSame(1, DB::table('outbox_recipients')->where('outbox_event_id', $event->id)->where('recipient_id', $captain->id)->where('in_app', true)->where('sms', true)->count());
        $this->assertFalse(config('messaging.sms.enabled'));
        $this->assertFalse(config('messaging.make.enabled'));
        $this->assertFalse(config('integration.dispatch_enabled'));
    }
}

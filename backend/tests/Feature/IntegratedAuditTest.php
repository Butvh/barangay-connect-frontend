<?php

namespace Tests\Feature;

use App\Contracts\P2\ReferenceData;
use App\Models\Facility;
use App\Models\Verification;
use App\Providers\IntegrationServiceProvider;
use App\Services\Facilities\FacilityAdministration;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Incidents\IncidentService;
use App\Services\Incidents\OverviewService;
use App\Services\Messaging\NotificationService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class IntegratedAuditTest extends TestCase
{
    use CombinedMysql;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        config(['integration.test_bindings' => true, 'integration.admin_test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
    }

    public function test_every_effective_role_is_accepted_only_in_its_selected_portal(): void
    {
        foreach (['resident', 'captain', 'secretary', 'responder', 'rescuer'] as $role) {
            $user = $this->sourceUser($role);
            $portal = $role === 'resident' ? 'resident' : 'official';
            $wrong = $portal === 'resident' ? 'official' : 'resident';
            $credentials = ['email' => $user->email, 'password' => 'IntegrationTest123'];
            $this->postJson('/api/v1/auth/login', $credentials + ['portal' => $wrong])
                ->assertUnauthorized()->assertJsonPath('code', 'AUTH')->assertJsonMissingPath('data');
            $this->assertGuest();
            $this->postJson('/api/v1/auth/login', $credentials + ['portal' => $portal])->assertOk()->assertJsonPath('data.id', $user->id);
            $this->postJson('/api/v1/auth/logout')->assertOk();
            Auth::forgetGuards();
        }
    }

    public function test_missing_or_forged_portal_cannot_bypass_login_restrictions(): void
    {
        $user = $this->sourceUser('resident');
        $input = ['email' => $user->email, 'password' => 'IntegrationTest123'];
        foreach ([[], ['portal' => 'captain'], ['portal' => true]] as $extra) {
            $this->postJson('/api/v1/auth/login', $input + $extra)->assertUnprocessable();
            $this->assertGuest();
        }
    }

    public function test_facility_creation_accepts_blank_optional_contact_and_retains_map_and_history(): void
    {
        $captain = $this->sourceUser('captain');
        DB::table('barangays')->where('id', $captain->barangay_id)->update(['map_scope' => 'sampaguita']);
        $service = app(FacilityAdministration::class);
        $row = $service->save(EffectiveIdentity::fromUser($captain), null, ['name' => 'Fictional audit school', 'type' => 'EvacuationCenter',
            'address' => 'Fictional School Road', 'capacity' => '300', 'contact' => '', 'notes' => '', 'status' => 'Active', 'map_x' => 43.76, 'map_y' => 73.22], 'audit-create-'.bin2hex(random_bytes(8)));
        $this->assertSame(300, $row['capacity']);
        $this->assertSame(43.76, $row['map_x']);
        $this->assertSame('sampaguita', $row['map_scope']);
        $this->assertCount(1, $row['history']);
        $this->assertSame('', $row['contact']);
    }

    public function test_unsupported_map_pin_returns_a_visible_actionable_field_error_without_saving(): void
    {
        $captain = $this->sourceUser('captain');
        $this->actingAs($captain)->withSession(['identity_role' => 'captain', 'identity_scope' => $captain->barangay_id, 'identity_version' => 0]);
        $this->postJson('/api/v1/facilities', ['name' => 'Fictional audit school', 'type' => 'Hospital', 'address' => 'Fictional street', 'map_x' => 40, 'map_y' => 70], ['Idempotency-Key' => 'audit-map-'.bin2hex(random_bytes(8))])
            ->assertUnprocessable()->assertJsonPath('fields.map_x', 'Map coverage is not available for this barangay.');
        $this->assertSame(0, Facility::where('managed_by_barangay_id', $captain->barangay_id)->count());
    }

    public function test_facility_capacity_validation_has_a_specific_safe_explanation(): void
    {
        $captain = $this->sourceUser('captain');
        $this->actingAs($captain)->withSession(['identity_role' => 'captain', 'identity_scope' => $captain->barangay_id, 'identity_version' => 0]);
        $this->postJson('/api/v1/facilities', ['name' => 'Fictional audit school', 'type' => 'Hospital', 'address' => 'Fictional street', 'capacity' => 'not-a-number'], ['Idempotency-Key' => 'audit-capacity-'.bin2hex(random_bytes(8))])
            ->assertUnprocessable()->assertJsonPath('fields.capacity', 'Enter a whole number.');
    }

    public function test_demo_notification_command_delivers_committed_assignment_once_and_keeps_recipients_private(): void
    {
        Http::preventStrayRequests();
        Queue::fake();
        $resident = $this->sourceUser();
        $captain = $this->sourceUser('captain', $resident->barangay_id);
        $responder = $this->sourceUser('responder', $resident->barangay_id);
        $stranger = $this->sourceUser('resident', $resident->barangay_id);
        Verification::forceCreate(['resident_id' => $resident->id, 'barangay_id' => $resident->barangay_id, 'review_status' => 'Approved']);
        $refs = app(ReferenceData::class);
        $service = app(IncidentService::class);
        $incident = $service->create($refs->actorFor($resident->id), ['alert_type' => 'Flood'], 'audit-notify-'.bin2hex(random_bytes(8)));
        $service->assign($refs->actorFor($captain->id), $incident['id'], ['personnel_id' => $responder->id, 'expected_revision' => 0], true);
        $notifications = app(NotificationService::class);
        $this->assertCount(0, $notifications->list($refs->actorFor($resident->id)));
        $this->artisan('notifications:deliver-demo', ['--limit' => 100])->assertSuccessful();
        $delivered = $notifications->list($refs->actorFor($resident->id));
        $this->assertNotEmpty($delivered);
        $this->assertCount(0, $notifications->list($refs->actorFor($stranger->id)));
        $this->artisan('notifications:deliver-demo', ['--limit' => 100])->assertSuccessful();
        $this->assertCount(count($delivered), $notifications->list($refs->actorFor($resident->id)));
        Http::assertNothingSent();
        Queue::assertNothingPushed();
        config(['messaging.sms.enabled' => true]);
        $this->artisan('notifications:deliver-demo')->assertFailed();
    }

    public function test_map_facilities_use_frontend_types_and_hide_inactive_entries_from_residents(): void
    {
        $resident = $this->sourceUser();
        $captain = $this->sourceUser('captain', $resident->barangay_id);
        Facility::forceCreate(['managed_by_barangay_id' => $resident->barangay_id, 'name' => 'Fictional pinned school',
            'type' => 'Evacuation Center', 'address' => 'Fictional road', 'active' => true, 'map_x' => 0, 'map_y' => 100, 'map_scope' => 'sampaguita']);
        Facility::forceCreate(['managed_by_barangay_id' => $resident->barangay_id, 'name' => 'Fictional inactive hospital',
            'type' => 'Hospital', 'address' => 'Fictional road', 'active' => false]);
        $refs = app(ReferenceData::class);
        $map = app(OverviewService::class);
        $rows = $map->map($refs->actorFor($resident->id))['facilities'];
        $this->assertNotContains('Inactive', array_column($rows, 'status'));
        // Other suites may retain intentionally shared referral facilities.
        $rows = array_values(array_filter($rows, fn ($row) => $row['managed_by_barangay_id'] === $resident->barangay_id));
        $this->assertCount(1, $rows);
        $this->assertSame('EvacuationCenter', $rows[0]['type']);
        $this->assertSame('Active', $rows[0]['status']);
        $this->assertSame(0.0, $rows[0]['map_x']);
        $official = $map->map($refs->actorFor($captain->id))['facilities'];
        $official = array_values(array_filter($official, fn ($row) => $row['managed_by_barangay_id'] === $resident->barangay_id));
        $this->assertCount(2, $official);
        $this->assertSame('Inactive', $official[1]['status']);
    }
}

<?php

namespace Tests\Unit\Messaging;

use App\Models\OutboxEvent;
use App\Services\Messaging\EventContract;
use Tests\DbaTestCase;

class EventContractV2Test extends DbaTestCase
{
    public function test_new_v2_ids_must_match_p1_canonical_uuid_v4_contract(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        EventContract::definition($this->incident(['event_id' => '018f1c74-98ef-7f27-a462-48beb6df4620']));
    }

    private function incident(array $overrides = []): OutboxEvent
    {
        return (new OutboxEvent)->forceFill(array_replace([
            'event_id' => '8c3f1c74-98ef-4f27-a462-48beb6df4620', 'version' => 2,
            'type' => 'incident.status_changed.v2', 'barangay_id' => 1, 'resource_type' => 'incident', 'resource_id' => 1,
            'payload' => ['status' => 'Acknowledged'], 'template_key' => 'incident-status-changed.v2',
            'occurred_at' => '2026-11-03T00:00:00Z',
        ], $overrides));
    }

    public function test_status_snapshot_is_explicitly_versioned_and_in_app_only(): void
    {
        $definition = EventContract::definition($this->incident());
        $this->assertSame('in_app', $definition['route']);
        $this->assertNull($definition['sms_template']);
        $this->assertSame('Acknowledged', $this->incident()->payload['status']);
    }

    public function test_private_or_unregistered_payload_fields_are_rejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        EventContract::definition($this->incident(['payload' => ['status' => 'Acknowledged', 'reset_code' => 'fictional-secret']]));
    }

    public function test_p2_prototype_32hex_ids_are_not_silently_converted(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        EventContract::definition($this->incident(['event_id' => str_repeat('a', 32)]));
    }

    public function test_v1_payload_cannot_silently_adopt_v2_snapshot_shape(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        EventContract::definition($this->incident(['version' => 1, 'type' => 'alert.created.v1', 'resource_type' => 'alert', 'template_key' => 'alert-review.v1']));
    }
}

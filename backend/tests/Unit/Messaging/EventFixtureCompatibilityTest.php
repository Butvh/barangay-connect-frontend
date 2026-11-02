<?php

namespace Tests\Unit\Messaging;

use App\Models\OutboxEvent;
use App\Services\Messaging\EventContract;
use App\Services\Messaging\EventContractViolation;
use Tests\DbaTestCase;

class EventFixtureCompatibilityTest extends DbaTestCase
{
    public function test_all_registered_v2_fixture_shapes_and_channel_rights(): void
    {
        $f = json_decode(file_get_contents(__DIR__.'/../../Fixtures/events-v2.json'), true, flags: JSON_THROW_ON_ERROR);
        foreach ($f['valid'] as $case) {
            $event = (new OutboxEvent)->forceFill(array_replace($f['base'], array_intersect_key($case, array_flip(['type', 'resource_type', 'template_key', 'payload']))));
            $definition = EventContract::definition($event);
            $this->assertSame($case['route'], $definition['route'], $case['type']);
            $this->assertSame($case['sms_authorized'], $definition['sms_template'] !== null, $case['type']);
        }
    }

    public function test_invalid_fixtures_fail_with_static_diagnostics_without_echoing_payload(): void
    {
        $f = json_decode(file_get_contents(__DIR__.'/../../Fixtures/events-v2.json'), true, flags: JSON_THROW_ON_ERROR);
        $base = array_replace($f['base'], array_intersect_key($f['valid'][0], array_flip(['type', 'resource_type', 'template_key', 'payload'])));
        foreach ($f['invalid'] as $case) {
            try {
                EventContract::definition((new OutboxEvent)->forceFill(array_replace($base, $case['patch'])));
                $this->fail($case['name']);
            } catch (EventContractViolation $e) {
                $this->assertSame($case['diagnostic'], $e->getMessage(), $case['name']);
            }
        }
    }
}

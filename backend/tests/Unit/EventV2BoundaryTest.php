<?php

namespace Tests\Unit;

use App\Contracts\Events\EventContext;
use App\Contracts\Events\RecipientReference;
use App\Models\OutboxEvent;
use App\Services\Messaging\EventContract;
use InvalidArgumentException;
use Tests\TestCase;

final class EventV2BoundaryTest extends TestCase
{
    public function test_p1_contexts_are_exact_bounded_snapshots_not_arbitrary_arrays(): void
    {
        foreach ([
            'verification.updated.v2' => ['status' => 'Resubmission requested'],
            'personnel.updated.v2' => ['role' => null, 'status' => 'Unassigned'],
            'facility.updated.v2' => ['status' => 'Inactive'],
            'security.updated.v2' => ['action' => 'access_revoked'],
            'household.updated.v2' => [],
        ] as $type => $payload) {
            $context = EventContext::forEvent($type, $payload);
            $this->assertSame($payload, $context->payloadFor($type));
        }
        $this->expectException(InvalidArgumentException::class);
        EventContext::forEvent('security.updated.v2', ['action' => 'password_reset', 'code' => '123456']);
    }

    public function test_event_context_cannot_change_families_or_substitute_later_status(): void
    {
        $context = EventContext::forEvent('incident.assigned.v2', ['status' => 'Acknowledged']);
        $this->assertSame(['status' => 'Acknowledged'], $context->payloadFor('incident.assigned.v2'));
        $this->expectException(InvalidArgumentException::class);
        $context->payloadFor('facility.updated.v2');
    }

    public function test_v2_recipient_requires_an_explicit_valid_audience(): void
    {
        $ref = new RecipientReference(42, true, false, 'official');
        $this->assertSame(['user_id' => 42, 'audience' => 'official', 'in_app' => true, 'sms' => false], $ref->toArray());
        $this->expectException(InvalidArgumentException::class);
        new RecipientReference(42, true, false, 'admin');
    }

    public function test_actual_dba_v2_fixture_agrees_with_the_typed_boundary(): void
    {
        $path = base_path('tests/Fixtures/events-v2.json');
        if (! is_file($path)) {
            $this->markTestSkipped('DBA-owned fixture is exercised in the pinned combined job.');
        }
        $fixture = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        foreach ($fixture['valid'] as $row) {
            $payload = EventContext::forEvent($row['type'], $row['payload'])->payloadFor($row['type']);
            $event = new OutboxEvent;
            $event->forceFill(array_merge($fixture['base'], $row, ['payload' => $payload]));
            $definition = EventContract::definition($event);
            $this->assertSame(2, $definition['version']);
            $this->assertSame($row['payload'], $payload);
        }
        foreach ($fixture['invalid'] as $case) {
            if (! array_key_exists('payload', $case['patch'])) {
                continue;
            }
            try {
                EventContext::forEvent('incident.created.v2', $case['patch']['payload']);
                $this->fail('Invalid DBA context was accepted: '.$case['name']);
            } catch (InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }
}

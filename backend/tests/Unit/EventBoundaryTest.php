<?php

namespace Tests\Unit;

use App\Contracts\Events\AuditSummary;
use App\Contracts\Events\EventId;
use App\Contracts\Events\RecipientReference;
use App\Contracts\Events\ResourceReference;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class EventBoundaryTest extends TestCase
{
    public function test_event_ids_are_canonical_v4_uuids_and_not_rewritten_legacy_ids(): void
    {
        $id = EventId::generate();
        $this->assertMatchesRegularExpression('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/', $id->value);
        $this->expectException(InvalidArgumentException::class);
        new EventId('0123456789abcdef0123456789abcdef');
    }

    public function test_audit_summary_is_bounded_structured_metadata_and_rejects_secrets(): void
    {
        $summary = new AuditSummary(['status' => 'Pending', 'revision' => 0, 'user_id' => 42]);
        $this->assertSame(0, $summary->values['revision']);
        $this->expectException(InvalidArgumentException::class);
        new AuditSummary(['password' => 'must never enter an audit record']);
    }

    public function test_oversized_summary_fails_before_a_writer_is_called(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new AuditSummary(['reason' => str_repeat('a', 5000)]);
    }

    public function test_recipient_defaults_to_in_app_without_sms_authorization(): void
    {
        $recipient = new RecipientReference(42);
        $this->assertTrue($recipient->inApp);
        $this->assertFalse($recipient->sms);
        $this->expectException(InvalidArgumentException::class);
        new RecipientReference(0);
    }

    public function test_resource_reference_is_an_allowlisted_server_reference(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new ResourceReference('../private-document', 1);
    }
}

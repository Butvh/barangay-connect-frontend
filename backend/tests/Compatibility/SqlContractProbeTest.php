<?php

namespace Tests\Compatibility;

use App\Contracts\Events\EventContext;
use App\Contracts\Events\EventId;
use App\Contracts\Events\OutboxWriter;
use App\Services\Messaging\EventContractViolation;
use App\Services\P2\Persistence\TypedOutboxWriter;
use Illuminate\Support\Facades\DB;
use Tests\MysqlDbaTestCase;

class SqlContractProbeTest extends MysqlDbaTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        if (! interface_exists(OutboxWriter::class)) {
            $this->markTestSkipped('Requires P1 typed interfaces.');
        }
        require_once __DIR__.'/Fixtures/SqlFixtures.php';
        config(['integration.connection' => 'mysql']);
    }

    public function test_in_app_only_configured_contract_does_not_require_sms_permission(): void
    {
        $report = (new SqlContractProbe($this->app))->run(new Fixtures\InAppOnlyTypedWriter, new Fixtures\CompatiblePerRecipientHandler);
        $this->assertFalse($report['sms_intent']);
        $this->assertContains('recipient_source_revocation', $report['checks']);
        $this->assertContains('sms_intent_not_requested', $report['checks']);
        $this->assertSame(0, $report['provider_calls']);
        $this->assertSame(0, DB::table('outbox_events')->count(), 'Probe fixtures must be removed after SQL/replay checks.');
    }

    public function test_authorized_sms_intent_is_a_separate_explicit_case_without_a_provider_send(): void
    {
        $report = (new SqlContractProbe($this->app))->run(new Fixtures\CompatibleTypedWriter, new Fixtures\CompatiblePerRecipientHandler, smsIntent: true);
        $this->assertTrue($report['sms_intent']);
        $this->assertContains('separate_authorized_sms_intent', $report['checks']);
        $this->assertSame(0, $report['provider_calls']);
    }

    public function test_a_writer_that_commits_the_caller_transaction_fails_acceptance(): void
    {
        $this->expectException(ContractCheckFailure::class);
        $this->expectExceptionMessage('writer_committed_independently');
        (new SqlContractProbe($this->app))->run(new Fixtures\IndependentlyCommittingWriter, new Fixtures\CompatiblePerRecipientHandler);
    }

    public function test_wrong_persisted_version_fails_even_with_a_compatible_php_interface(): void
    {
        $this->expectException(EventContractViolation::class);
        (new SqlContractProbe($this->app))->run(new Fixtures\WrongVersionWriter, new Fixtures\CompatiblePerRecipientHandler);
    }

    public function test_a_void_handler_cannot_create_false_successful_receipts(): void
    {
        $this->expectException(ContractCheckFailure::class);
        $this->expectExceptionMessage('handler_receipt_not_complete');
        (new SqlContractProbe($this->app))->run(new Fixtures\CompatibleTypedWriter, new Fixtures\NoopHandler);
    }

    public function test_actual_p2_sms_rejection_is_specific_and_never_a_positive_probe(): void
    {
        $this->expectException(ContractCheckFailure::class);
        $this->expectExceptionMessage('sms_intent_unsupported_in_app_only_writer');
        (new SqlContractProbe($this->app))->run(new TypedOutboxWriter,
            new Fixtures\CompatiblePerRecipientHandler, smsIntent: true);
    }

    public function test_same_logic_exception_from_an_unexpected_writer_is_not_hidden(): void
    {
        $writer = new class extends Fixtures\CompatibleTypedWriter
        {
            public function record(EventId $eventId, string $type, int $scope, int $resourceId,
                array $recipientRefs, \DateTimeImmutable $occurredAt, EventContext $context = new EventContext): void
            {
                if ($recipientRefs[0]->sms) {
                    throw new \LogicException('Use distinct in-app-only recipient references.');
                }
                parent::record($eventId, $type, $scope, $resourceId, $recipientRefs, $occurredAt, $context);
            }
        };
        $this->expectException(\LogicException::class);
        $this->expectExceptionMessage('Use distinct in-app-only recipient references.');
        (new SqlContractProbe($this->app))->run($writer, new Fixtures\CompatiblePerRecipientHandler, smsIntent: true);
    }
}

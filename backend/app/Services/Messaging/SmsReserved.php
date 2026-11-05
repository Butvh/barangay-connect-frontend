<?php

namespace App\Services\Messaging;

/** Internal after-commit observation; never a P2 business event or second outbox writer. */
final readonly class SmsReserved
{
    public function __construct(public int $deliveryId, public string $claimToken) {}
}

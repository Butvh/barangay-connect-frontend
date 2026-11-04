<?php

namespace App\Services\Identity;

use Closure;

/** Actual P1 authority exists; DBA's current reservation integration remains separately gated. */
interface SmsDeliveryEligibility
{
    /**
     * Start outside any transaction: recipient/account/appointment -> consent -> source/ledger.
     * The callback runs only for current consent, in the same named MySQL transaction.
     * It may authorize current source and reserve a delivery, never call a provider/network.
     * Commit before external send; recheck every reservation/retry/final pre-send gate.
     * False denial skips the callback; unavailable authority fails closed.
     *
     * @param  Closure(int, string, string): bool  $reserve  Consent revision, policy and template versions.
     */
    public function withCurrentEligibility(EffectiveIdentity $recipient, string $purpose, Closure $reserve): bool;
}

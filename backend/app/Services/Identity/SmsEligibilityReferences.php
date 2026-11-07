<?php

namespace App\Services\Identity;

/** Ratified P1 port; CurrentSmsConsent is selected only in the reviewed opt-in profile. */
interface SmsEligibilityReferences
{
    /**
     * Short current guarded read, outside any existing transaction, before source locks.
     * Check original generation, active role/scope and persisted purpose/version consent.
     * False for known denial/absent preference; unavailable authority must never return true.
     * This filters producer intent only; it cannot authorize a queued provider call.
     */
    public function allows(EffectiveIdentity $recipient, string $purpose): bool;
}

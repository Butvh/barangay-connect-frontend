<?php

namespace Tests\Unit;

use App\Contracts\Photos\IncidentPhotos;
use App\Services\Identity\SmsDeliveryEligibility;
use App\Services\Identity\SmsEligibilityReferences;
use Illuminate\Contracts\Container\BindingResolutionException;
use Tests\TestCase;

final class SmsConsentBoundaryTest extends TestCase
{
    public function test_unavailable_authorities_cannot_be_resolved_as_enabled_services(): void
    {
        foreach ([IncidentPhotos::class, SmsEligibilityReferences::class, SmsDeliveryEligibility::class] as $port) {
            $this->assertFalse($this->app->bound($port));
            try {
                $this->app->make($port);
                $this->fail('A missing private-byte/consent authority resolved successfully.');
            } catch (BindingResolutionException) {
                $this->addToAssertionCount(1);
            }
        }
    }
}

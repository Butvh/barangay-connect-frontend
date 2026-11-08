<?php

namespace Tests\Unit;

use App\Contracts\Photos\IncidentPhotos;
use App\Providers\IntegrationServiceProvider;
use App\Services\Identity\SmsDeliveryEligibility;
use App\Services\Identity\SmsEligibilityReferences;
use Illuminate\Contracts\Container\BindingResolutionException;
use Tests\TestCase;

final class SmsConsentBoundaryTest extends TestCase
{
    public function test_consent_selection_cannot_bypass_the_reviewed_disposable_profile(): void
    {
        config(['integration.consent_test_bindings' => true, 'integration.test_bindings' => false]);
        $this->expectException(\LogicException::class);
        (new IntegrationServiceProvider($this->app))->register();
    }

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

<?php

namespace Tests\Unit;

use App\Contracts\Photos\StagedIncidentPhoto;
use App\Services\Identity\EffectiveIdentity;
use Illuminate\Auth\GenericUser;
use Tests\TestCase;

final class IncidentPhotoContractTest extends TestCase
{
    public function test_private_photo_receipt_cannot_be_a_filename_or_change_owners(): void
    {
        $owner = EffectiveIdentity::fromUser(new GenericUser(['id' => 1, 'barangay_id' => 1, 'is_captain' => true, 'auth_version' => 0, 'account_status' => 'Active']));
        $receipt = new StagedIncidentPhoto('8c3f1c74-98ef-4f27-a462-48beb6df4620', $owner, 'image/png', 32, new \DateTimeImmutable('2026-11-03T01:00:00Z'));
        $receipt->assertOwnedBy($owner);
        $this->assertArrayNotHasKey('object_key', $receipt->toArray());
        $this->assertArrayNotHasKey('owner', $receipt->toArray());
        $this->expectException(\InvalidArgumentException::class);
        new StagedIncidentPhoto('photo.png', $owner, 'image/png', 32, new \DateTimeImmutable);
    }
}

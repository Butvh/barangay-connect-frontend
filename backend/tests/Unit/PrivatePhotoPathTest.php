<?php

namespace Tests\Unit;

use App\Services\Photos\PrivatePhotoObjects;
use App\Support\ApiProblem;
use Tests\TestCase;

final class PrivatePhotoPathTest extends TestCase
{
    public function test_arbitrary_key_and_public_root_cannot_receive_private_objects(): void
    {
        $objects = new PrivatePhotoObjects;
        try {
            $objects->path('../public/file.png');
            $this->fail('Traversal accepted.');
        } catch (ApiProblem $error) {
            $this->assertSame(503, $error->status);
        }
        config(['filesystems.disks.private_incident_photos.root' => public_path('photos')]);
        $this->expectException(ApiProblem::class);
        $objects->put('incident-photos/aa/'.str_repeat('b', 64), 'private');
    }

    public function test_object_is_never_overwritten_and_symlink_is_rejected(): void
    {
        $root = storage_path('app/private/path-tests-'.bin2hex(random_bytes(8)));
        config(['filesystems.disks.private_incident_photos.root' => $root]);
        $objects = new PrivatePhotoObjects;
        $key = 'incident-photos/aa/'.str_repeat('a', 64);
        $objects->put($key, 'original');
        try {
            $objects->put($key, 'replacement');
            $this->fail('Immutable object was overwritten.');
        } catch (ApiProblem) {
            $this->assertSame('original', file_get_contents($objects->path($key)));
        }
        $link = $root.'/incident-photos/bb';
        if (! @symlink($root.'/incident-photos/aa', $link)) {
            $this->markTestSkipped('OS does not permit symlink fixtures; Linux CI must exercise this.');
        }
        $this->expectException(ApiProblem::class);
        $objects->path('incident-photos/bb/'.str_repeat('a', 64));
    }
}

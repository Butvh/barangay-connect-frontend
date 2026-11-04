<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use Tests\Support\LockedUserIds;

final class LockedUserIdsTest extends TestCase
{
    public function test_scope_and_status_bindings_are_not_mistaken_for_locked_people(): void
    {
        $this->assertSame([12], LockedUserIds::from('select * from `users` where `barangay_id` = ? and `users`.`id` = ? and `active` = ? for update', [7, 12, 1]));
        $this->assertSame([12, 14], LockedUserIds::from('select * from `users` where `id` in (?, ?) and `barangay_id` = ? for update', [12, 14, 7]));
    }

    public function test_an_unrecognized_whole_user_lock_cannot_silently_pass_the_gate(): void
    {
        $this->expectException(\LogicException::class);
        LockedUserIds::from('select * from `users` where `barangay_id` = ? for update', [7]);
    }
}

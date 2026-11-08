<?php

namespace App\Services\Messaging;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class RateGate
{
    public function take(string $endpoint, int $limit): int
    {
        return DB::transaction(function () use ($endpoint, $limit) {
            DB::table('messaging_rate_windows')->insertOrIgnore(['endpoint' => $endpoint, 'window_start' => now(), 'requests' => 0]);
            $row = DB::table('messaging_rate_windows')->where('endpoint', $endpoint)->lockForUpdate()->first();
            if ($row->blocked_until && now()->lt($row->blocked_until)) {
                return max(1, (int) ceil(now()->diffInSeconds($row->blocked_until)));
            }
            $start = CarbonImmutable::parse($row->window_start);
            if (now()->gte($start->addSeconds(60))) {
                DB::table('messaging_rate_windows')->where('endpoint', $endpoint)->update(['window_start' => now(), 'requests' => 1, 'blocked_until' => null]);

                return 0;
            }
            if ($row->requests >= $limit) {
                return max(1, (int) ceil(now()->diffInSeconds($start->addSeconds(60))));
            }
            DB::table('messaging_rate_windows')->where('endpoint', $endpoint)->increment('requests');

            return 0;
        });
    }

    public function block(string $endpoint, int $seconds): void
    {
        DB::table('messaging_rate_windows')->where('endpoint', $endpoint)->update(['blocked_until' => now()->addSeconds($seconds)]);
    }
}

<?php

namespace App\Console\Commands;

use App\Services\Messaging\OutboxDispatcher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/** In-app rehearsal worker. Never invokes DispatchOutbox's SMS/Make job scan. */
final class DeliverDemoNotifications extends Command
{
    protected $signature = 'notifications:deliver-demo {--limit=100} {--watch} {--seconds=3600}';

    protected $description = 'Deliver committed in-app events in an explicitly disposable, external-delivery-disabled build';

    public function handle(): int
    {
        $name = DB::connection('mysql')->getDatabaseName();
        if (! $this->laravel->environment('testing') || ! config('integration.test_bindings') ||
            getenv('DB_TEST_DISPOSABLE') !== '1' || $name !== getenv('DB_TEST_DATABASE') ||
            ! preg_match('/^(?:bc_dba_p[12]_|p2_test_)[A-Za-z0-9_]+$/D', $name) ||
            config('messaging.sms.enabled') || config('messaging.make.enabled') || config('integration.dispatch_enabled')) {
            $this->error('Requires a confirmed disposable integrated build with SMS, Make and external dispatch disabled.');

            return self::FAILURE;
        }
        $limit = filter_var($this->option('limit'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000]]);
        $seconds = filter_var($this->option('seconds'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 3600]]);
        if ($limit === false || $seconds === false) {
            $this->error('Use a limit from 1 to 1000 and duration from 1 to 3600 seconds.');

            return self::FAILURE;
        }
        $deadline = microtime(true) + $seconds;
        do {
            $processed = 0;
            while ($processed < $limit && microtime(true) < $deadline && app(OutboxDispatcher::class)->dispatchOne()) {
                $processed++;
            }
            $this->info('Processed '.$processed.' committed events; no external delivery jobs started.');
            if (! $this->option('watch') || microtime(true) >= $deadline) {
                break;
            }
            usleep(1000000);
        } while (microtime(true) < $deadline);

        return self::SUCCESS;
    }
}

<?php

namespace Tests;

use Illuminate\Support\Facades\Http;
use Orchestra\Testbench\TestCase;

abstract class DbaTestCase extends TestCase
{
    protected function defineEnvironment($app): void
    {
        $app['config']->set('app.key', 'base64:'.base64_encode(str_repeat('x', 32)));
        $app['config']->set('messaging', require __DIR__.'/../config/messaging.php');
        $app['config']->set('messaging.sms.enabled', true);
        $app['config']->set('messaging.sms.key', 'fake-key');
        $app['config']->set('messaging.sms.sender', 'Approved');
        $app['config']->set('messaging.sms.allowlist', ['639171234567']);
        $app['config']->set('queue.default', 'sync');
        $app['config']->set('cache.default', 'array');
        $app['config']->set('hashing.bcrypt.rounds', 4);
    }

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }
}

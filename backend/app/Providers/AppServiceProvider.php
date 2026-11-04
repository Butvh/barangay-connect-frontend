<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use LogicException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Laravel merges default disks into configuration. Keep only the reviewed
        // private disk before FilesystemServiceProvider registers file-serving routes.
        $this->app['config']->set('filesystems.disks', ['local' => config('filesystems.disks.local'),
            'private_incident_photos' => config('filesystems.disks.private_incident_photos')]);
        // DBA models and P2 writers are registered by their reviewed slices.
    }

    public function boot(): void
    {
        if ($this->app->environment('production') && (
            config('app.debug') || ! config('session.secure') || ! config('session.http_only') ||
            config('session.same_site') !== 'lax' || ! str_starts_with(config('app.url'), 'https://')
        )) {
            throw new LogicException('Production requires HTTPS, protected cookies, and debug disabled.');
        }
        RateLimiter::for('csrf', fn (Request $request) => Limit::perMinute(120)->by($request->ip()));
        RateLimiter::for('photo-upload', fn (Request $request) => Limit::perMinute(10)->by('photo:'.$request->user()?->getAuthIdentifier().':'.$request->ip()));
        RateLimiter::for('consent-write', fn (Request $request) => Limit::perMinute(20)->by('consent:'.$request->user()?->getAuthIdentifier().':'.$request->ip()));
        RateLimiter::for('login', function (Request $request) {
            $input = $request->input('email');
            $email = is_string($input) ? mb_strtolower(trim($input)) : '';
            $key = hash_hmac('sha256', $email, config('app.key'));

            return [Limit::perMinute(30)->by('ip:'.$request->ip()), Limit::perMinute(5)->by('account:'.$key)];
        });
    }
}

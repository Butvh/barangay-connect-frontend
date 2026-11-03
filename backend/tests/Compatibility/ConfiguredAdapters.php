<?php

namespace Tests\Compatibility;

use App\Contracts\Events\OutboxWriter;
use App\Services\Messaging\InAppNotificationHandler;
use Illuminate\Contracts\Container\Container;

final class ConfiguredAdapters
{
    public function __construct(private Container $app, private bool $testFixtures = false) {}

    /** The CLI never permits test fixtures; unit tests exercise this resolver explicitly. */
    public function resolve(array $explicit = []): array
    {
        $adapters = [];
        $diagnostics = [];
        $selected = [];
        foreach (['outbox' => [OutboxWriter::class, 'outbox_adapter'], 'notification' => [InAppNotificationHandler::class, 'notification_adapter']] as $name => [$port, $setting]) {
            try {
                if (! interface_exists($port)) {
                    throw new ContractCheckFailure('reviewed_interface_unavailable');
                }
                $class = $explicit[$name] ?? null;
                $instance = null;
                if ($class === null && $this->app->bound($port)) {
                    $instance = $this->app->make($port);
                    $class = get_class($instance);
                }
                $class ??= $this->app['config']->get('integration.'.$setting);
                if ($class === null) {
                    throw new ContractCheckFailure($setting.'_not_configured');
                }
                if (! is_string($class) || ! preg_match('/^[A-Za-z_][A-Za-z0-9_]*(?:\\\\[A-Za-z_][A-Za-z0-9_]*)+$/D', $class) || ! class_exists($class)) {
                    throw new ContractCheckFailure($setting.'_invalid_class');
                }
                $r = new \ReflectionClass($class);
                if (! $r->isInstantiable() || ! $r->implementsInterface($port)) {
                    throw new ContractCheckFailure($setting.'_wrong_interface');
                }
                if (! $this->testFixtures) {
                    $file = str_replace('\\', '/', realpath($r->getFileName()) ?: '');
                    $root = rtrim(str_replace('\\', '/', realpath($this->app->basePath('app')) ?: ''), '/').'/';
                    if (! str_starts_with(strtolower($file), strtolower($root)) || str_starts_with($class, 'Tests\\')) {
                        throw new ContractCheckFailure($setting.'_not_production_source');
                    }
                }
                $instance ??= $this->app->make($class);
                if (! $instance instanceof $port) {
                    throw new ContractCheckFailure($setting.'_wrong_instance');
                }
                $adapters[$name] = $instance;
                $selected[$name] = $class;
            } catch (ContractCheckFailure $e) {
                $diagnostics[] = $e->getMessage();
            } catch (\Throwable) {
                $diagnostics[] = $setting.'_dependency_unavailable';
            }
        }

        return ['adapters' => $diagnostics ? [] : $adapters, 'selected' => $selected, 'diagnostics' => $diagnostics];
    }
}

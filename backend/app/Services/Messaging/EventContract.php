<?php

namespace App\Services\Messaging;

use App\Models\OutboxEvent;
use Illuminate\Support\Str;

final class EventContract
{
    public static function definition(OutboxEvent $event): array
    {
        // Dotted event names are literal map keys, not Laravel dotted config paths.
        $definition = config('messaging.events', [])[$event->type] ?? null;
        if ($event->version !== 1 || ! $definition || $event->resource_type !== $definition['resource']
            || $event->template_key !== $definition['template'] || $event->resource_id < 1
            || ! Str::isUuid($event->event_id) || ! empty($event->payload)) {
            throw new \InvalidArgumentException('unsupported_event_envelope');
        }

        return $definition;
    }

    public static function message(OutboxEvent $event): string
    {
        $definition = self::definition($event);

        return $definition['route'] === 'urgent'
            ? 'Barangay Connect: a new SOS requires your attention. Sign in to review alert A-'.$event->resource_id.'.'
            : 'Barangay Connect: a new community announcement is available. Sign in to review announcement '.$event->resource_id.'.';
    }
}

<?php

namespace App\Services\Messaging;

use App\Models\OutboxEvent;
use Illuminate\Support\Facades\DB;

final class MakeSmsCommandService
{
    public function accept(array $command): bool
    {
        return DB::transaction(function () use ($command) {
            $event = OutboxEvent::where('event_id', $command['event_id'])->lockForUpdate()->first();
            if (! $event || $event->barangay_id !== config('messaging.make.barangay_id')
                || $event->barangay_id !== $command['barangay_id'] || $event->type !== $command['type'] || $event->template_key !== $command['template_key']) {
                abort(403, 'Command scope is not authorized.');
            }
            if (EventContract::definition($event)['route'] !== 'make' || ! DB::table('make_dispatches')->where('outbox_event_id', $event->id)->exists()) {
                abort(403, 'Command route is not authorized.');
            }
            $hash = hash('sha256', json_encode([$event->event_id, $command['barangay_id'], $command['type'], $command['template_key']], JSON_THROW_ON_ERROR));
            $existing = DB::table('make_commands')->where('outbox_event_id', $event->id)->first();
            if ($existing && ! hash_equals($existing->payload_hash, $hash)) {
                abort(409, 'Command was changed.');
            }
            if ($existing) {
                return false;
            }
            DB::table('make_commands')->insert(['outbox_event_id' => $event->id, 'credential_id' => config('messaging.make.credential_id'), 'payload_hash' => $hash, 'received_at' => now()]);
            DB::table('make_dispatches')->where('outbox_event_id', $event->id)->update(['command_received_at' => now()]);

            // Scheduler pumps existing SMS rows. No recipient/message fields are accepted from Make.
            return true;
        });
    }
}

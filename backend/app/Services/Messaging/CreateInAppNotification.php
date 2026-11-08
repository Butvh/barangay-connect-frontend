<?php

declare(strict_types=1);

namespace App\Services\Messaging;

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Services\P2\Problem;

final class CreateInAppNotification
{
    public function __construct(private Store $store, private ReferenceData $refs, private \Closure $clock) {}

    public function handle(array $event): int
    {
        $id = $event['event_id'] ?? '';
        if (! is_string($id) || ! preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $id)) {
            throw new \InvalidArgumentException('Invalid event.');
        }

        return $this->store->transaction(['outbox:'.$id], function () use ($id) {
            $event = $this->store->select('outbox_events', ['event_id' => $id])[0] ?? throw new \LogicException('Outbox event is not persisted.');
            if (($event['payload']['version'] ?? null) !== 1) {
                throw new \LogicException('Unsupported event version.');
            } $resource = explode('.', $event['event_type'])[0];
            if (! in_array($resource, ['incident', 'feedback', 'announcement'], true)) {
                throw new \LogicException('P1 event needs its authorized notification handler before dispatch.');
            }
            $count = 0;
            foreach ($event['payload']['recipients'] as $ref) {
                if (! in_array('in_app', $ref['channels'], true)) {
                    continue;
                }
                try {
                    $a = $this->refs->actorFor($ref['user_id']);
                } catch (Problem $e) {
                    continue;
                }
                $row = ['event_id' => $id, 'user_id' => $a->id, 'barangay_id' => $event['barangay_id'], 'channel' => 'in_app', 'resource_type' => $resource, 'resource_id' => $event['resource_id'], 'audience' => $ref['audience'], 'created_at' => $event['occurred_at'], 'read_at' => null, 'dismissed_at' => null];
                $source = NotificationAccess::source($this->store, $this->refs, $a, $row, ($this->clock)());
                if (! $source) {
                    continue;
                }
                if ($this->store->select('notifications', ['event_id' => $id, 'user_id' => $a->id, 'channel' => 'in_app'])) {
                    continue;
                }
                $row['kind'] = match ($resource) {
                    'incident' => $event['event_type'] === 'incident.created' ? 'alert_new' : 'alert_status','feedback' => 'feedback_update','announcement' => 'announcement'
                };
                $row['event_status'] = $resource === 'incident' ? ($event['payload']['context']['status'] ?? null) : null;
                $row['title'] = $resource === 'incident' ? 'A-'.$source['id'].' · '.($row['event_status'] ?? 'Update') : ($resource === 'feedback' ? 'Feedback update' : $source['title']);
                $row['description'] = '';
                $row['link'] = NotificationAccess::link($row, $source);
                $this->store->insert('notifications', $row);
                $count++;
            }

            return $count;
        });
    }
}

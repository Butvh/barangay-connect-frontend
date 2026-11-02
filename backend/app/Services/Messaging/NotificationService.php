<?php

declare(strict_types=1);

namespace App\Services\Messaging;

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Services\P2\Actor;
use App\Services\P2\Problem;

final class NotificationService
{
    public function __construct(private Store $store, private ReferenceData $refs, private \Closure $clock) {}

    private function fresh(Actor $a): void
    {
        $current = $this->refs->actorFor($a->id);
        if ($current->role !== $a->role || $current->barangayId !== $a->barangayId) {
            throw new Problem('FORBIDDEN', 'Account access changed.');
        }
    }

    public function list(Actor $a, array $options = []): array
    {
        $this->fresh($a);
        $rows = $this->store->select('notifications', ['user_id' => $a->id, 'barangay_id' => $a->barangayId]);
        $rows = array_filter($rows, fn ($n) => ! $n['dismissed_at'] && NotificationAccess::source($this->store, $this->refs, $a, $n, ($this->clock)()) && (! isset($options['is_read']) || ($n['read_at'] !== null) === $options['is_read']));
        usort($rows, fn ($x, $y) => strcmp($y['created_at'], $x['created_at']));

        return array_map(fn ($n) => array_replace($n, ['is_read' => $n['read_at'] !== null, 'link' => NotificationAccess::link($n, NotificationAccess::source($this->store, $this->refs, $a, $n, ($this->clock)()))]), array_values($rows));
    }

    public function get(Actor $a, int $id): array
    {
        $this->fresh($a);
        $n = $this->owned($a, $id);

        return array_replace($n, ['is_read' => $n['read_at'] !== null, 'link' => NotificationAccess::link($n, NotificationAccess::source($this->store, $this->refs, $a, $n, ($this->clock)()))]);
    }

    private function owned(Actor $a, int $id): array
    {
        $this->fresh($a);
        $n = $this->store->select('notifications', ['id' => $id, 'user_id' => $a->id, 'barangay_id' => $a->barangayId])[0] ?? null;
        if (! $n || $n['dismissed_at'] || ! NotificationAccess::source($this->store, $this->refs, $a, $n, ($this->clock)())) {
            throw new Problem('NOT_FOUND', 'Notification is unavailable.');
        }

        return $n;
    }

    public function setRead(Actor $a, int $id, bool $read): array
    {
        return $this->store->transaction(['person:'.$a->id], function () use ($a, $id, $read) {
            $this->owned($a, $id);
            $this->store->update('notifications', $id, ['read_at' => $read ? ($this->clock)() : null]);

            return $this->get($a, $id);
        });
    }

    public function dismiss(Actor $a, int $id): array
    {
        return $this->store->transaction(['person:'.$a->id], function () use ($a, $id) {
            $this->owned($a, $id);
            $this->store->update('notifications', $id, ['dismissed_at' => ($this->clock)()]);

            return ['id' => $id];
        });
    }

    public function clearRead(Actor $a): int
    {
        return $this->bulk($a, true);
    }

    public function markAllRead(Actor $a): int
    {
        return $this->bulk($a, false);
    }

    private function bulk(Actor $a, bool $dismiss): int
    {
        return $this->store->transaction(['person:'.$a->id], function () use ($a, $dismiss) {
            $count = 0;
            foreach ($this->list($a) as $n) {
                if (($dismiss && $n['read_at'] !== null) || (! $dismiss && $n['read_at'] === null)) {
                    $this->store->update('notifications', $n['id'], $dismiss ? ['dismissed_at' => ($this->clock)()] : ['read_at' => ($this->clock)()]);
                    $count++;
                }
            }

            return $count;
        });
    }
}

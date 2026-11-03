<?php

declare(strict_types=1);

namespace App\Services\Messaging;

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Services\P2\Actor;

final class NotificationAccess
{
    public static function source(Store $s, ReferenceData $refs, Actor $a, array $n, string $now): ?array
    {
        if ($n['user_id'] !== $a->id || $n['barangay_id'] !== $a->barangayId) {
            return null;
        }
        $table = match ($n['resource_type']) {
            'incident' => 'emergency_alerts','feedback' => 'community_feedback','announcement' => 'announcements',default => null
        };
        if (! $table) {
            return null;
        }
        $r = $s->select($table, ['id' => $n['resource_id'], 'barangay_id' => $a->barangayId])[0] ?? null;
        if (! $r) {
            return null;
        }
        if ($n['audience'] === 'resident') {
            if ($a->role !== 'resident') {
                return null;
            } if ($n['resource_type'] === 'announcement') {
                return $r['status'] === 'Active' && (! $r['expires_at'] || strtotime($r['expires_at']) > strtotime($now)) ? $r : null;
            }

            return $r['resident_id'] === $a->id ? $r : null;
        }
        if ($a->administrator()) {
            return $r;
        }

        if ($n['resource_type'] !== 'incident' || ! in_array($a->role, ['responder', 'rescuer'], true)) {
            return null;
        }
        $assignments = $s->select('alert_assignments', ['alert_id' => $r['id'], 'barangay_id' => $a->barangayId, 'role' => $a->role]);
        usort($assignments, fn ($x, $y) => $y['id'] <=> $x['id']);
        $latest = $assignments[0] ?? null;

        return $latest && in_array($latest['status'], ['active', 'completed', 'closed'], true) && $latest['user_id'] === $a->id ? $r : null;
    }

    public static function link(array $n, ?array $source = null): string
    {
        if ($n['resource_type'] === 'feedback') {
            $type = $source['type'] ?? null;

            return in_array($type, ['complaint', 'suggestion', 'general'], true) ? ($n['audience'] === 'resident' ? 'resident' : 'official').'-feedback.html?type='.$type.'&id='.$n['resource_id'] : '';
        }

        return match ($n['resource_type']) {
            'incident' => ($n['audience'] === 'resident' ? 'resident' : 'official').'-alert.html?id='.$n['resource_id'],'feedback' => ($n['audience'] === 'resident' ? 'resident' : 'official').'-feedback.html?id='.$n['resource_id'],'announcement' => ($n['audience'] === 'resident' ? 'resident' : 'official').'-announcements.html?id='.$n['resource_id'],default => ''
        };
    }
}

<?php

declare(strict_types=1);

namespace App\Services\Civic;

use App\Contracts\P2\ActorReferences;
use App\Contracts\P2\TanodReferences;
use App\Services\P2\Actor;
use App\Services\P2\Module;
use App\Services\P2\Problem;
use App\Services\P2\Rules;

final class CivicService extends Module
{
    public function announcements(Actor $a, array $options = []): array
    {
        $rows = $this->store->select('announcements', ['barangay_id' => $a->barangayId]);
        $q = mb_strtolower((string) ($options['q'] ?? ''));
        $rows = array_filter($rows, fn ($r) => ($a->administrator() || $this->status($r) === 'Active') && (! isset($options['status']) || $this->status($r) === $options['status']) && (! $q || str_contains(mb_strtolower($r['title'].' '.$r['content']), $q)));
        usort($rows, fn ($x, $y) => strcmp($y['published_at'], $x['published_at']) ?: $y['id'] <=> $x['id']);

        return array_map(fn ($r) => $this->announcement($a, $r['id']), array_values($rows));
    }

    public function status(array $r): string
    {
        return $r['status'] === 'Active' && $r['expires_at'] !== null && Rules::time($r['expires_at']) <= Rules::time(($this->clock)()) ? 'Archived' : $r['status'];
    }

    public function announcement(Actor $a, int $id): array
    {
        $r = $this->row('announcements', $id, $a);
        if (! $a->administrator() && $this->status($r) !== 'Active') {
            throw new Problem('NOT_FOUND', 'This announcement is unavailable.');
        } $r['status'] = $this->status($r);
        $r['author'] = Rules::publicPerson($this->references($a)->person($r['posted_by'], $a->barangayId));
        if ($a->administrator()) {
            $r['history'] = $this->store->select('announcement_history', ['announcement_id' => $id, 'barangay_id' => $a->barangayId]);
            foreach ($r['history'] as $history) {
                if (in_array($history['action'], ['Archived', 'Retracted'], true)) {
                    $r[strtolower($history['action']).'_by'] = $history['by'];
                }
            }
        }

        return $r;
    }

    private function expires(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        } if (! is_string($value) || ! preg_match('/(?:Z|[+-]\d{2}:\d{2})$/D', $value) || ! ($t = Rules::time($value)) || $t <= Rules::time(($this->clock)())) {
            throw new Problem('VALIDATION', 'Choose a future expiration with a timezone.');
        }

        return $t->format(DATE_ATOM);
    }

    public function publish(Actor $a, array $in, string $key): array
    {
        $a->allow(['captain', 'secretary']);
        Rules::key($key);
        $sms = $this->smsPreflight($a, 'publish', $key, 'barangay_announcements',
            fn () => array_values(array_filter($this->references($a)->people($a->barangayId), fn ($p) => in_array($p['role'], ['resident', 'captain', 'secretary'], true))));

        return $this->once($a, 'publish', $in, $key, fn () => $this->publishWrite($a, $in, $sms), fn ($resource) => $this->announcement($a, $resource));
    }

    private function publishWrite(Actor $a, array $in, array $sms = []): array
    {
        $a->allow(['captain', 'secretary']);
        Rules::only($in, ['title', 'content', 'expires_at']);
        $title = Rules::text($in['title'] ?? null, 'title', 200);
        $content = Rules::text($in['content'] ?? null, 'content', 5000);
        $expires = $this->expires($in['expires_at'] ?? null);

        return $this->atomic($a, [], null, function () use ($a, $title, $content, $expires, $sms) {
            $r = $this->store->insert('announcements', ['barangay_id' => $a->barangayId, 'posted_by' => $a->id, 'author_role' => $a->role, 'title' => $title, 'content' => $content, 'status' => 'Active', 'expires_at' => $expires, 'created_at' => ($this->clock)(), 'published_at' => ($this->clock)(), 'updated_at' => ($this->clock)(), 'revision' => 1]);
            $this->announcementHistory($a, $r, 'Published');
            $this->event($a, 'announcement.published', $r['id'], array_values(array_filter($this->references($a)->people($a->barangayId), fn ($p) => in_array($p['role'], ['resident', 'captain', 'secretary'], true))), $sms);

            return $this->announcement($a, $r['id']);
        });
    }

    public function edit(Actor $a, int $id, array $in): array
    {
        return $this->announcementChange($a, $id, $in, 'Edited');
    }

    public function archive(Actor $a, int $id, array $in): array
    {
        return $this->announcementChange($a, $id, $in, 'Archived');
    }

    public function retract(Actor $a, int $id, array $in): array
    {
        return $this->announcementChange($a, $id, $in, 'Retracted');
    }

    public function expireOverdue(Actor $a): int
    {
        $a->allow(['captain', 'secretary']);
        $count = 0;
        foreach ($this->store->select('announcements', ['barangay_id' => $a->barangayId, 'status' => 'Active']) as $before) {
            $count += $this->store->transaction(['person:'.$a->id, 'announcement:'.$before['id']], function () use ($a, $before) {
                $fresh = $this->refs instanceof ActorReferences ? $this->refs->locked($a) : $this->refs->actorFor($a->id);
                if ($fresh->role !== $a->role || $fresh->barangayId !== $a->barangayId) {
                    throw new Problem('FORBIDDEN', 'Account access changed.');
                }
                $row = $this->row('announcements', $before['id'], $a);
                if ($row['status'] !== 'Active' || $this->status($row) !== 'Archived') {
                    return 0;
                }
                $row = $this->store->update('announcements', $row['id'], ['status' => 'Archived', 'revision' => $row['revision'] + 1, 'updated_at' => ($this->clock)(), 'archived_at' => $row['expires_at']]);
                $this->store->insert('announcement_history', ['announcement_id' => $row['id'], 'barangay_id' => $a->barangayId, 'action' => 'Expired', 'by' => null, 'at' => $row['expires_at'], 'title' => $row['title'], 'content' => $row['content'], 'expires_at' => $row['expires_at'], 'reason' => '']);
                $this->audit($a, 'announcement', $row['id'], 'Announcement expiry recorded', ['revision' => $row['revision']]);

                return 1;
            });
        }

        return $count;
    }

    private function announcementChange(Actor $a, int $id, array $in, string $action): array
    {
        $a->allow(['captain', 'secretary']);
        Rules::only($in, $action === 'Edited' ? ['title', 'content', 'expires_at', 'expected_revision'] : ['reason', 'expected_revision']);

        return $this->store->transaction(['person:'.$a->id, 'announcement:'.$id], function () use ($a, $id, $in, $action) {
            $fresh = $this->refs instanceof ActorReferences ? $this->refs->locked($a) : $this->refs->actorFor($a->id);
            if (! $fresh->administrator() || $fresh->barangayId !== $a->barangayId) {
                throw new Problem('FORBIDDEN', 'Account access changed.');
            } $r = $this->row('announcements', $id, $a);
            Rules::revision($r, $in);
            if (! in_array($this->status($r), $action === 'Retracted' ? ['Active', 'Archived'] : ['Active'], true)) {
                throw new Problem('INVALID_STATE', 'This announcement cannot use that action.');
            } $patch = ['revision' => $r['revision'] + 1, 'updated_at' => ($this->clock)()];
            $reason = '';
            if ($action === 'Edited') {
                foreach (['title' => 200, 'content' => 5000] as $f => $max) {
                    if (array_key_exists($f, $in)) {
                        $patch[$f] = Rules::text($in[$f], $f, $max);
                    }
                } if (array_key_exists('expires_at', $in)) {
                    $patch['expires_at'] = $this->expires($in['expires_at']);
                }
            } else {
                $patch['status'] = $action;
                $reason = Rules::text($in['reason'] ?? '', 'reason', 500, $action === 'Retracted');
                $patch += $action === 'Retracted' ? ['retracted_at' => ($this->clock)(), 'retraction_reason' => $reason] : ['archived_at' => ($this->clock)()];
            }
            $r = $this->store->update('announcements', $id, $patch);
            $this->announcementHistory($a, $r, $action, $reason);

            return $this->announcement($a, $id);
        });
    }

    private function announcementHistory(Actor $a, array $r, string $action, string $reason = ''): void
    {
        $this->store->insert('announcement_history', ['announcement_id' => $r['id'], 'barangay_id' => $a->barangayId, 'action' => $action, 'by' => $a->id, 'role_at_action' => $a->role, 'at' => ($this->clock)(), 'title' => $r['title'], 'content' => $r['content'], 'expires_at' => $r['expires_at'], 'reason' => $reason]);
        $this->audit($a, 'announcement', $r['id'], 'Announcement '.$action, ['revision' => $r['revision']]);
    }

    public function feedback(Actor $a, array $options = []): array
    {
        $a->allow(['resident', 'captain', 'secretary']);
        $where = ['barangay_id' => $a->barangayId];
        if (isset($options['resident_id'])) {
            if ($a->role === 'resident' && (int) $options['resident_id'] !== $a->id) {
                throw new Problem('FORBIDDEN', 'View your own feedback.');
            }
            $where['resident_id'] = (int) $options['resident_id'];
        }
        if ($a->role === 'resident') {
            $where['resident_id'] = $a->id;
        }
        $rows = array_filter($this->store->select('community_feedback', $where), fn ($r) => (! isset($options['type']) || $r['type'] === $options['type']) && (! isset($options['status']) || $r['status'] === $options['status']) && (! isset($options['rating']) || $r['rating'] === (int) $options['rating']) && (! isset($options['q']) || str_contains(mb_strtolower(($r['title'] ?? '').' '.($r['description'] ?? '').' '.($r['comment'] ?? '')), mb_strtolower($options['q']))));
        usort($rows, fn ($x, $y) => strcmp($y['submitted_at'], $x['submitted_at']));
        if (($options['sort'] ?? 'newest') === 'oldest') {
            $rows = array_reverse($rows);
        }

        return array_map(fn ($r) => $this->feedbackItem($a, $r['id']), array_values($rows));
    }

    public function feedbackItem(Actor $a, int $id): array
    {
        $a->allow(['resident', 'captain', 'secretary']);
        $r = $this->row('community_feedback', $id, $a);
        if ($a->role === 'resident' && $r['resident_id'] !== $a->id) {
            throw new Problem('NOT_FOUND', 'This feedback is unavailable.');
        } $r['resident'] = Rules::publicPerson($this->references($a)->person($r['resident_id'], $a->barangayId));
        $r['assigned_tanod'] = $r['assigned_tanod_id'] ? Rules::publicPerson($this->references($a)->person($r['assigned_tanod_id'], $a->barangayId)) : null;

        return $r;
    }

    public function submitFeedback(Actor $a, array $in, string $key): array
    {
        return $this->once($a, 'submitFeedback', $in, $key, fn () => $this->submitFeedbackWrite($a, $in), fn ($resource) => $this->feedbackItem($a, $resource));
    }

    private function submitFeedbackWrite(Actor $a, array $in): array
    {
        $a->allow(['resident']);
        Rules::only($in, ['type', 'category', 'description', 'location', 'rating', 'comment']);
        $type = Rules::choice($in['type'] ?? null, ['complaint', 'suggestion', 'general'], 'type');
        $base = ['barangay_id' => $a->barangayId, 'resident_id' => $a->id, 'type' => $type, 'assigned_tanod_id' => null, 'created_at' => ($this->clock)(), 'submitted_at' => ($this->clock)(), 'assigned_at' => null, 'resolved_at' => null, 'revision' => 0, 'rating' => null, 'comment' => null, 'category' => '', 'location' => '', 'description' => '', 'status' => $type === 'general' ? null : 'Pending'];
        if ($type === 'general') {
            if (! is_int($in['rating'] ?? null) || $in['rating'] < 1 || $in['rating'] > 5) {
                throw new Problem('VALIDATION', 'Choose a rating from 1 to 5.');
            } $base['rating'] = $in['rating'];
            $base['comment'] = Rules::text($in['comment'] ?? null, 'comment', 2000);
            $base['title'] = mb_substr($base['comment'], 0, 100);
        } else {
            foreach (['category' => 100, 'location' => 200, 'description' => 2000] as $f => $max) {
                $base[$f] = Rules::text($in[$f] ?? ($f === 'location' ? '' : null), $f, $max, $f !== 'location');
            } $base['title'] = mb_substr($base['description'], 0, 100);
        }

        return $this->atomic($a, [], null, function () use ($a, $base) {
            $r = $this->store->insert('community_feedback', $base);
            $this->audit($a, 'feedback', $r['id'], 'Feedback submitted');
            $this->event($a, 'feedback.submitted', $r['id'], $this->officials($a));

            return $this->feedbackItem($a, $r['id']);
        });
    }

    public function assignFeedback(Actor $a, int $id, array $in): array
    {
        return $this->feedbackChange($a, $id, $in, true);
    }

    // Display-only options never acquire eligibility locks. The write rechecks
    // the selected person under the existing person -> feedback lock protocol.
    public function feedbackAssignmentOptions(Actor $a, int $id): array
    {
        $a->allow(['captain', 'secretary']);
        $r = $this->row('community_feedback', $id, $a);
        if ($r['type'] === 'general' || $r['status'] !== 'Pending') {
            throw new Problem('INVALID_STATE', 'Only pending complaints and suggestions can be assigned.');
        }
        $refs = $this->references($a);
        $people = array_filter($refs instanceof TanodReferences ? $refs->feedbackTanods($a->barangayId) : $refs->people($a->barangayId), fn ($p) => $p['barangay_id'] === $a->barangayId && ($p['is_tanod'] ?? false) && ($p['account_status'] ?? 'Active') === 'Active' && ($p['personnel_status'] ?? 'Active') === 'Active');

        return ['feedback_revision' => $r['revision'], 'tanods' => array_values(array_map(fn ($p) => ['id' => $p['id'], 'full_name' => $p['full_name']], $people))];
    }

    public function resolveFeedback(Actor $a, int $id, array $in): array
    {
        return $this->feedbackChange($a, $id, $in, false);
    }

    private function feedbackChange(Actor $a, int $id, array $in, bool $assign): array
    {
        $a->allow(['captain', 'secretary']);
        Rules::only($in, $assign ? ['tanod_id', 'expected_revision'] : ['expected_revision']);

        $tanod = $assign ? Rules::id($in['tanod_id'] ?? null, 'tanod_id') : null;

        return $this->store->transaction(['person:'.$a->id, ...($tanod ? ['person:'.$tanod] : []), 'feedback:'.$id], function () use ($a, $id, $in, $assign, $tanod) {
            $fresh = $this->refs instanceof ActorReferences ? $this->refs->locked($a) : $this->refs->actorFor($a->id);
            if (! $fresh->administrator() || $fresh->barangayId !== $a->barangayId) {
                throw new Problem('FORBIDDEN', 'Account access changed.');
            } $r = $this->row('community_feedback', $id, $a);
            if ($r['type'] === 'general' || $r['status'] === 'Resolved' || ($assign && $r['status'] !== 'Pending')) {
                throw new Problem('INVALID_STATE', 'This feedback cannot use that workflow.');
            } Rules::revision($r, $in);
            $patch = ['revision' => $r['revision'] + 1];
            if ($assign) {
                $idTanod = $tanod;
                $p = $this->eligiblePerson($a, $idTanod);
                if (! $p || ! ($p['is_tanod'] ?? false) || ($p['account_status'] ?? 'Active') !== 'Active' || ($p['personnel_status'] ?? 'Active') !== 'Active') {
                    throw new Problem('VALIDATION', 'Choose an existing local Tanod.');
                } $patch += ['assigned_tanod_id' => $idTanod, 'assigned_at' => ($this->clock)(), 'status' => 'Assigned'];
            } else {
                $patch += ['status' => 'Resolved', 'resolved_at' => ($this->clock)()];
            }
            $r = $this->store->update('community_feedback', $id, $patch);
            $this->audit($a, 'feedback', $id, 'Feedback '.$r['status'], ['status' => $r['status']]);
            $this->event($a, 'feedback.updated', $id, [$this->references($a)->person($r['resident_id'], $a->barangayId)]);

            return $this->feedbackItem($a, $id);
        });
    }
}

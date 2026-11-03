<?php

declare(strict_types=1);

namespace App\Http\Controllers\P2;

use App\Contracts\P2\ReferenceData;
use App\Services\Messaging\NotificationService;
use App\Services\P2\Problem;
use App\Services\P2\Rules;
use Illuminate\Http\Request;

final class NotificationController extends P2Controller
{
    public function __construct(ReferenceData $refs, private NotificationService $notifications)
    {
        parent::__construct($refs);
    }

    public function index(Request $r)
    {
        $q = $this->query($r, ['is_read']);
        if (isset($q['is_read'])) {
            $q['is_read'] = match ($q['is_read']) {
                'true' => true,'false' => false,default => throw new Problem('VALIDATION', 'Choose a read filter.')
            };
        }

        return $this->listing($this->notifications->list($this->actor($r), $q));
    }

    public function show(Request $r, string $id)
    {
        return $this->data($this->notifications->get($this->actor($r), $this->id($id)));
    }

    public function update(Request $r, string $id)
    {
        $in = $this->body($r);
        Rules::only($in, ['is_read']);
        if (! is_bool($in['is_read'] ?? null)) {
            throw new Problem('VALIDATION', 'Choose read or unread.');
        }

        return $this->data($this->notifications->setRead($this->actor($r), $this->id($id), $in['is_read']));
    }

    public function dismiss(Request $r, string $id)
    {
        return $this->data($this->notifications->dismiss($this->actor($r), $this->id($id)));
    }

    public function readAll(Request $r)
    {
        return $this->data($this->notifications->markAllRead($this->actor($r)));
    }

    public function clearRead(Request $r)
    {
        $a = $this->actor($r);
        $in = $this->body($r);
        Rules::only($in, ['recipient_id', 'expected_role']);
        if ((isset($in['recipient_id']) && $in['recipient_id'] !== $a->id) || (isset($in['expected_role']) && $in['expected_role'] !== $a->role)) {
            throw new Problem('FORBIDDEN', 'Reopen Notifications for the current account.');
        }

        return $this->data($this->notifications->clearRead($a));
    }
}

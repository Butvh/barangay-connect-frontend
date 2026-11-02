<?php

namespace App\Contracts\Events;

use InvalidArgumentException;

/** Historical incident status only; never recipients, credentials or message bodies. */
final readonly class EventContext
{
    public function __construct(public ?string $status = null)
    {
        if ($status !== null && ! in_array($status, ['Pending', 'Acknowledged', 'Responding', 'Rescue in progress', 'Resolved'], true)) {
            throw new InvalidArgumentException('Unsupported event context.');
        }
    }
}

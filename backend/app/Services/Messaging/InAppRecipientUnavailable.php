<?php

namespace App\Services\Messaging;

/** P2 throws this when current source authorization no longer permits this recipient. */
final class InAppRecipientUnavailable extends \RuntimeException
{
    public function __construct()
    {
        parent::__construct('in_app_recipient_unavailable');
    }
}

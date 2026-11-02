<?php

namespace App\Services\Messaging;

final class TransportFailure extends \RuntimeException
{
    public function __construct(string $category, public readonly bool $uncertain = false, public readonly ?int $retryAfter = null, public readonly ?int $httpStatus = null)
    {
        // Never chain a transport exception: its URL/body can contain the provider key or recipient.
        parent::__construct($category);
    }
}

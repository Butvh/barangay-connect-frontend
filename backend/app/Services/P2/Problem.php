<?php

declare(strict_types=1);

namespace App\Services\P2;

final class Problem extends \RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message, public readonly array $fields = [])
    {
        parent::__construct($message);
    }

    public function status(): int
    {
        return match ($this->errorCode) {
            'AUTH' => 401, 'FORBIDDEN' => 403, 'NOT_FOUND' => 404, 'CONFLICT','CAPACITY','INVALID_STATE' => 409, 'VALIDATION' => 422, default => 503
        };
    }
}

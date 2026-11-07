<?php

namespace App\Support;

use RuntimeException;

final class ApiProblem extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        public readonly int $status,
        string $message,
        public readonly array $fields = [],
    ) {
        parent::__construct($message);
    }
}

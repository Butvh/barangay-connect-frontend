<?php

namespace App\Contracts\Events;

use InvalidArgumentException;

final readonly class AuditSummary
{
    public function __construct(public array $values = [])
    {
        if (array_diff(array_keys($values), ['status', 'assignment_id', 'previous_user_id', 'user_id', 'reason', 'revision'])) {
            throw new InvalidArgumentException('Audit metadata contains unsupported fields.');
        }
        foreach ($values as $key => $value) {
            $valid = match ($key) {
                'status' => is_string($value) && mb_strlen($value) <= 100,
                'reason' => $value === null || (is_string($value) && mb_strlen($value) <= 1000),
                'revision' => is_int($value) && $value >= 0,
                default => $value === null || (is_int($value) && $value > 0),
            };
            if (! $valid) {
                throw new InvalidArgumentException('Audit metadata has an invalid value.');
            }
        }
        if (strlen(json_encode((object) $values, JSON_THROW_ON_ERROR)) > 4096) {
            throw new InvalidArgumentException('Audit metadata exceeds the v1 byte limit.');
        }
    }
}

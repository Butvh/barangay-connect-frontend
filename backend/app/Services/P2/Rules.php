<?php

declare(strict_types=1);

namespace App\Services\P2;

final class Rules
{
    public static function only(array $input, array $allowed): void
    {
        if (array_diff(array_keys($input), $allowed)) {
            throw new Problem('VALIDATION', 'Unexpected or protected input fields.');
        }
    }

    public static function text(mixed $value, string $field, int $max = 1000, bool $required = true): string
    {
        if (! is_string($value) || ($required && trim($value) === '') || mb_strlen($value) > $max) {
            throw new Problem('VALIDATION', 'Check '.$field.'.', [$field => 'Check this field.']);
        }

        return trim($value);
    }

    public static function choice(mixed $v, array $choices, string $field): string
    {
        if (! is_string($v) || ! in_array($v, $choices, true)) {
            throw new Problem('VALIDATION', 'Choose a valid '.$field.'.', [$field => 'Choose an available value.']);
        }

        return $v;
    }

    public static function id(mixed $v, string $field = 'id'): int
    {
        if (! is_int($v) || $v < 1) {
            throw new Problem('VALIDATION', 'Choose a valid '.$field.'.');
        }

        return $v;
    }

    public static function revision(array $row, array $input, string $field = 'revision'): void
    {
        if (! isset($input['expected_revision']) || ! is_int($input['expected_revision']) || $input['expected_revision'] !== ($row[$field] ?? 0)) {
            throw new Problem('CONFLICT', 'This record changed. Refresh and review the latest version.');
        }
    }

    public static function time(?string $value): ?\DateTimeImmutable
    {
        if (! $value || ! preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/D', $value)) {
            return null;
        } try {
            $date = new \DateTimeImmutable($value);
            $errors = \DateTimeImmutable::getLastErrors();

            return $errors && ($errors['warning_count'] || $errors['error_count']) ? null : $date;
        } catch (\Exception) {
            return null;
        }
    }

    public static function publicPerson(?array $p): ?array
    {
        return $p === null ? null : array_intersect_key($p, array_flip(['id', 'full_name', 'barangay_id', 'role', 'personnel_status', 'is_resident', 'is_captain', 'is_secretary', 'is_responder', 'is_rescuer', 'is_tanod']));
    }

    public static function key(mixed $key): string
    {
        if (! is_string($key) || ! preg_match('/^[A-Za-z0-9_-]{8,128}$/D', $key)) {
            throw new Problem('VALIDATION', 'Provide an idempotency key of 8–128 safe characters.');
        }

        return $key;
    }
}

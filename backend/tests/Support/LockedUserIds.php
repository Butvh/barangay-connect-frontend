<?php

namespace Tests\Support;

final class LockedUserIds
{
    public static function from(string $sql, array $bindings): array
    {
        if (! preg_match_all('/(?:`users`\.)?`id`\s*(?:=\s*\?|in\s*\([?,\s]+\))/i', $sql, $matches, PREG_OFFSET_CAPTURE)) {
            throw new \LogicException('Unrecognized user lock predicate; inspect the actual acquired rows.');
        }
        $ids = [];
        foreach ($matches[0] as [$predicate, $offset]) {
            $start = substr_count(substr($sql, 0, $offset), '?');
            foreach (array_slice($bindings, $start, substr_count($predicate, '?')) as $id) {
                if (! is_int($id) || $id < 1) {
                    throw new \LogicException('User lock IDs must be explicit positive integers.');
                }
                $ids[] = $id;
            }
        }

        return array_values(array_unique($ids));
    }
}

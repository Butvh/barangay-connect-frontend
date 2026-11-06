<?php

use App\Services\Photos\PrivatePhotoObjects;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Test evidence only. Never print raw rows, payloads, object keys or credentials.
function civicRowsHash(array $rows): string
{
    $canonical = function ($value) use (&$canonical) {
        if (! is_array($value)) {
            return $value;
        }
        if (! array_is_list($value)) {
            ksort($value, SORT_STRING);
        }

        return array_map($canonical, $value);
    };
    $encoded = array_map(fn ($row) => json_encode($canonical($row), JSON_THROW_ON_ERROR), $rows);
    sort($encoded, SORT_STRING);

    return hash('sha256', implode("\n", $encoded));
}

function civicLockedUserIds(string $sql, array $bindings): array
{
    // Scope is also a numeric binding: it is not another locked user's ID.
    if (! preg_match('/(?:`users`\.)?`id`\s*(?:=\s*\?|in\s*\(\s*\?(?:\s*,\s*\?)*\s*\))/i', $sql, $match, PREG_OFFSET_CAPTURE)) {
        throw new LogicException('Unrecognized user-lock query shape.');
    }
    $start = substr_count(substr($sql, 0, $match[0][1]), '?');
    $count = substr_count($match[0][0], '?');
    $ids = array_slice($bindings, $start, $count);
    if (count($ids) !== $count) {
        throw new LogicException('Missing user-lock evidence bindings.');
    }

    return array_map('intval', $ids);
}

function civicDatabaseState(): array
{
    $state = [];
    foreach (Schema::getTableListing(null, false) as $table) {
        if (in_array($table, ['sessions', 'cache', 'cache_locks'], true)) {
            continue;
        }
        $rows = DB::table($table)->get()->map(fn ($row) => (array) $row)->all();
        $state[$table] = ['count' => count($rows), 'sha256' => civicRowsHash($rows)];
    }
    $objects = [];
    foreach (DB::table('incident_photos')->get() as $row) {
        $path = (new PrivatePhotoObjects)->path($row->object_key);
        $objects[] = ['id' => $row->id, 'exists' => is_file($path), 'sha256' => is_file($path) ? hash_file('sha256', $path) : null];
    }
    $state['private_photo_objects'] = ['count' => count($objects), 'sha256' => civicRowsHash($objects)];
    ksort($state, SORT_STRING);

    return $state;
}

<?php

declare(strict_types=1);

namespace App\Contracts\P2;

use Closure;

interface Store
{
    /** Atomic transaction; acquire guard locks in supplied order. Never invoke external I/O here. */
    public function transaction(array $keys, Closure $work): mixed;

    public function inTransaction(): bool;

    /** Equality predicates must be applied in SQL; no unscoped read-then-filter adapter. */
    public function select(string $table, array $where = []): array;

    public function insert(string $table, array $row): array;

    public function update(string $table, int $id, array $patch): array;
}

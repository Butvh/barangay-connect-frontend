<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IdempotencyRequest extends Model
{
    use HasFactory;

    protected $table = 'idempotency_requests';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['outcome' => 'array', 'expires_at' => 'immutable_datetime'];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}

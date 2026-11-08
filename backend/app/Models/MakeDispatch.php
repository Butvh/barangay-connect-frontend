<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MakeDispatch extends Model
{
    use HasFactory;

    protected $table = 'make_dispatches';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['accepted_at' => 'immutable_datetime', 'command_received_at' => 'immutable_datetime', 'lease_until' => 'immutable_datetime', 'next_attempt_at' => 'immutable_datetime'];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(OutboxEvent::class, 'outbox_event_id');
    }
}

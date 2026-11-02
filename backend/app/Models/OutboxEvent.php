<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class OutboxEvent extends Model
{
    use HasFactory;

    protected $table = 'outbox_events';

    protected $guarded = ['*'];

    public $timestamps = false;

    protected function casts(): array
    {
        return ['version' => 'integer', 'barangay_id' => 'integer', 'resource_id' => 'integer', 'payload' => 'array', 'occurred_at' => 'immutable_datetime', 'created_at' => 'immutable_datetime', 'lease_until' => 'immutable_datetime', 'next_attempt_at' => 'immutable_datetime', 'dispatched_at' => 'immutable_datetime', 'blocked_at' => 'immutable_datetime'];
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(OutboxRecipient::class, 'outbox_event_id');
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(DeliveryReceipt::class, 'outbox_event_id');
    }

    public function automation(): HasOne
    {
        return $this->hasOne(MakeDispatch::class, 'outbox_event_id');
    }
}

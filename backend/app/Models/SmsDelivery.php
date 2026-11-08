<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SmsDelivery extends Model
{
    use HasFactory;

    protected $table = 'sms_deliveries';

    protected $fillable = ['receipt_id'];

    protected $hidden = ['destination', 'destination_digest'];

    protected function casts(): array
    {
        return ['destination' => 'encrypted', 'next_attempt_at' => 'immutable_datetime', 'reconcile_at' => 'immutable_datetime', 'lease_until' => 'immutable_datetime', 'budget_reserved_at' => 'immutable_datetime'];
    }

    public function receipt(): BelongsTo
    {
        return $this->belongsTo(DeliveryReceipt::class, 'receipt_id');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(SmsAttempt::class, 'sms_delivery_id');
    }
}

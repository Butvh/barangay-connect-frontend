<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class DeliveryReceipt extends Model
{
    use HasFactory;

    protected $table = 'delivery_receipts';

    protected $fillable = ['outbox_event_id', 'recipient_id', 'channel', 'template_key'];

    protected function casts(): array
    {
        return ['completed_at' => 'immutable_datetime', 'failed_at' => 'immutable_datetime'];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(OutboxEvent::class, 'outbox_event_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    public function sms(): HasOne
    {
        return $this->hasOne(SmsDelivery::class, 'receipt_id');
    }
}

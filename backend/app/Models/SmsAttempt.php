<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmsAttempt extends Model
{
    use HasFactory;

    protected $table = 'sms_attempts';

    protected $guarded = ['*'];

    public $timestamps = false;

    protected function casts(): array
    {
        return ['started_at' => 'immutable_datetime', 'finished_at' => 'immutable_datetime'];
    }

    public function delivery(): BelongsTo
    {
        return $this->belongsTo(SmsDelivery::class, 'sms_delivery_id');
    }
}

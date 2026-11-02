<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OutboxRecipient extends Model
{
    use HasFactory;

    protected $table = 'outbox_recipients';

    protected $guarded = ['*'];

    public $timestamps = false;

    protected function casts(): array
    {
        return ['in_app' => 'boolean', 'sms' => 'boolean'];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(OutboxEvent::class, 'outbox_event_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }
}

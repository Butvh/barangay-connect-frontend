<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    use HasFactory;

    protected $table = 'notifications';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['recipient_id' => 'integer', 'barangay_id' => 'integer', 'resource_id' => 'integer', 'read_at' => 'immutable_datetime', 'dismissed_at' => 'immutable_datetime'];
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Private persistence; absence is never a granted default or a stored revision0. */
class NotificationPreference extends Model
{
    protected $guarded = ['*'];

    protected $visible = ['__private_metadata__'];

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected function casts(): array
    {
        return ['user_id' => 'integer', 'barangay_id' => 'integer', 'recorded_by' => 'integer',
            'revision' => 'integer', 'granted_at' => 'immutable_datetime', 'revoked_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime', 'updated_at' => 'immutable_datetime'];
    }

    public function toArray(): array
    {
        return [];
    }

    protected static function booted(): void
    {
        static::deleting(fn () => throw new \LogicException('notification_preferences_retained'));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}

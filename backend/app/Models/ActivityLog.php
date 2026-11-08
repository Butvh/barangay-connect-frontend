<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    use HasFactory;

    protected $table = 'activity_logs';

    protected $guarded = ['*'];

    public $timestamps = false;

    protected function casts(): array
    {
        return ['summary' => 'array', 'occurred_at' => 'immutable_datetime', 'recorded_at' => 'immutable_datetime'];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class, 'barangay_id');
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('immutable_record'));
        static::deleting(fn () => throw new \LogicException('retained_record'));
    }
}

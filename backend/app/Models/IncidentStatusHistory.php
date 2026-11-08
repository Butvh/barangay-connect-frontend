<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncidentStatusHistory extends Model
{
    use HasFactory;

    protected $table = 'incident_status_history';

    protected $guarded = ['*'];

    public $timestamps = false;

    protected function casts(): array
    {
        return ['occurred_at' => 'immutable_datetime', 'recorded_at' => 'immutable_datetime', 'sequence' => 'integer'];
    }

    public function alert(): BelongsTo
    {
        return $this->belongsTo(EmergencyAlert::class, 'alert_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('immutable_record'));
        static::deleting(fn () => throw new \LogicException('retained_record'));
    }
}

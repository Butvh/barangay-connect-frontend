<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Private immutable evidence; P1 projects history only after current manager authorization. */
class FacilityHistory extends Model
{
    protected $table = 'facility_history';

    public $timestamps = false;

    protected $guarded = ['*'];

    protected $visible = ['__private_history__'];

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected function casts(): array
    {
        return ['facility_id' => 'integer', 'barangay_id' => 'integer', 'actor_id' => 'integer',
            'revision' => 'integer', 'snapshot' => 'array', 'occurred_at' => 'immutable_datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('facility_history_immutable'));
        static::deleting(fn () => throw new \LogicException('facility_history_immutable'));
    }

    public function toArray(): array
    {
        return [];
    }

    public function facility(): BelongsTo
    {
        return $this->belongsTo(Facility::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}

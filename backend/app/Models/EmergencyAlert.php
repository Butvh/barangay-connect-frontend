<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmergencyAlert extends Model
{
    use HasFactory;

    protected $table = 'emergency_alerts';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['map_x' => 'decimal:4', 'map_y' => 'decimal:4', 'victim_count' => 'integer', 'assignment_revision' => 'integer', 'reported_at' => 'immutable_datetime', 'acknowledged_at' => 'immutable_datetime', 'resolved_at' => 'immutable_datetime'];
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resident_id');
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class, 'household_id');
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class, 'barangay_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(AlertAssignment::class, 'alert_id');
    }

    public function responses(): HasMany
    {
        return $this->hasMany(AlertResponse::class, 'alert_id');
    }

    public function rescues(): HasMany
    {
        return $this->hasMany(Rescue::class, 'alert_id');
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(IncidentStatusHistory::class, 'alert_id');
    }
}

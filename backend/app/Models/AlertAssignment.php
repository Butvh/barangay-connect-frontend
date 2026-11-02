<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AlertAssignment extends Model
{
    use HasFactory;

    protected $table = 'alert_assignments';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['legacy' => 'boolean', 'assigned_at' => 'immutable_datetime', 'ended_at' => 'immutable_datetime', 'override_at' => 'immutable_datetime'];
    }

    public function alert(): BelongsTo
    {
        return $this->belongsTo(EmergencyAlert::class, 'alert_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function assigner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function responses(): HasMany
    {
        return $this->hasMany(AlertResponse::class, 'assignment_id');
    }

    public function rescues(): HasMany
    {
        return $this->hasMany(Rescue::class, 'assignment_id');
    }
}

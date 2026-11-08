<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Rescue extends Model
{
    use HasFactory;

    protected $table = 'rescues';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['destination_snapshot' => 'array', 'legacy' => 'boolean', 'rescued_at' => 'immutable_datetime'];
    }

    public function alert(): BelongsTo
    {
        return $this->belongsTo(EmergencyAlert::class, 'alert_id');
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(AlertAssignment::class, 'assignment_id');
    }

    public function rescuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rescuer_id');
    }

    public function facility(): BelongsTo
    {
        return $this->belongsTo(Facility::class, 'facility_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AlertResponse extends Model
{
    use HasFactory;

    protected $table = 'alert_responses';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['rescue_required' => 'boolean', 'legacy' => 'boolean', 'responded_at' => 'immutable_datetime'];
    }

    public function alert(): BelongsTo
    {
        return $this->belongsTo(EmergencyAlert::class, 'alert_id');
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(AlertAssignment::class, 'assignment_id');
    }

    public function responder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responder_id');
    }
}

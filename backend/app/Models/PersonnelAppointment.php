<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PersonnelAppointment extends Model
{
    use HasFactory;

    protected $table = 'personnel_appointments';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['effective_date' => 'immutable_date', 'legacy' => 'boolean', 'revision' => 'integer', 'added_externally_at' => 'immutable_datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class, 'barangay_id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(PersonnelHistory::class, 'appointment_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'appointment_id');
    }

    public function assigner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}

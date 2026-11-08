<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Household extends Model
{
    use HasFactory;

    protected $table = 'households';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['map_x' => 'decimal:4', 'map_y' => 'decimal:4', 'revision' => 'integer'];
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class, 'barangay_id');
    }

    public function residents(): HasMany
    {
        return $this->hasMany(User::class, 'household_id');
    }
}

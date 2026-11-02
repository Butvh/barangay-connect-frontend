<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Facility extends Model
{
    use HasFactory;

    protected $table = 'facilities';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['active' => 'boolean', 'capacity' => 'integer', 'map_x' => 'decimal:4', 'map_y' => 'decimal:4', 'revision' => 'integer'];
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(Barangay::class, 'managed_by_barangay_id');
    }

    public function rescues(): HasMany
    {
        return $this->hasMany(Rescue::class, 'facility_id');
    }
}

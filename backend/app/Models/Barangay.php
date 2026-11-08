<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Barangay extends Model
{
    use HasFactory;

    protected $table = 'barangays';

    protected $guarded = ['*'];

    public function households(): HasMany
    {
        return $this->hasMany(Household::class, 'barangay_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'barangay_id');
    }

    public function facilities(): HasMany
    {
        return $this->hasMany(Facility::class, 'managed_by_barangay_id');
    }
}

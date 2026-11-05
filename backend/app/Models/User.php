<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasFactory;

    protected $table = 'users';

    protected $guarded = ['*'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['id' => 'integer', 'barangay_id' => 'integer', 'household_id' => 'integer', 'auth_version' => 'integer', 'is_resident' => 'boolean', 'is_captain' => 'boolean', 'password' => 'hashed', 'last_login_at' => 'immutable_datetime', 'email_verified_at' => 'immutable_datetime'];
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class, 'barangay_id');
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class, 'household_id');
    }

    public function appointment(): HasOne
    {
        return $this->hasOne(PersonnelAppointment::class, 'user_id');
    }

    public function tanodMembership(): HasOne
    {
        return $this->hasOne(TanodMembership::class, 'user_id');
    }

    public function verifications(): HasMany
    {
        return $this->hasMany(Verification::class, 'resident_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'recipient_id');
    }
}

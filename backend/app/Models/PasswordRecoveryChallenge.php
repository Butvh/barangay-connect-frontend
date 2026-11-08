<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PasswordRecoveryChallenge extends Model
{
    use HasFactory;

    protected $table = 'password_recovery_challenges';

    protected $guarded = ['*'];

    protected $hidden = ['email_digest', 'code_digest', 'authorization_digest'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['expires_at' => 'immutable_datetime', 'resend_available_at' => 'immutable_datetime', 'verified_at' => 'immutable_datetime', 'superseded_at' => 'immutable_datetime', 'consumed_at' => 'immutable_datetime', 'authorization_expires_at' => 'immutable_datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Verification extends Model
{
    use HasFactory;

    protected $table = 'verifications';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['deadline_at' => 'immutable_datetime', 'reviewed_at' => 'immutable_datetime', 'correction_requested_at' => 'immutable_datetime', 'revision' => 'integer'];
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resident_id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(VerificationSubmission::class, 'verification_id');
    }

    public function currentSubmission(): BelongsTo
    {
        return $this->belongsTo(VerificationSubmission::class, 'current_submission_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}

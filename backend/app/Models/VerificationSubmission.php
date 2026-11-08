<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VerificationSubmission extends Model
{
    use HasFactory;

    protected $table = 'verification_submissions';

    protected $guarded = ['*'];

    public $timestamps = false;

    protected function casts(): array
    {
        return ['revision' => 'integer', 'submitted_at' => 'immutable_datetime'];
    }

    public function verification(): BelongsTo
    {
        return $this->belongsTo(Verification::class, 'verification_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'submission_id');
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('immutable_record'));
        static::deleting(fn () => throw new \LogicException('retained_record'));
    }
}

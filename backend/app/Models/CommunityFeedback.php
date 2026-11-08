<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityFeedback extends Model
{
    use HasFactory;

    protected $table = 'community_feedback';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['rating' => 'integer', 'revision' => 'integer', 'reviewed_by' => 'integer', 'archived_by' => 'integer',
            'submitted_at' => 'immutable_datetime', 'assigned_at' => 'immutable_datetime', 'resolved_at' => 'immutable_datetime',
            'reviewed_at' => 'immutable_datetime', 'archived_at' => 'immutable_datetime'];
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resident_id');
    }

    public function tanod(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_tanod_id');
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class, 'barangay_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function archiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'archived_by');
    }
}

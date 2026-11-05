<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Announcement extends Model
{
    use HasFactory;

    protected $table = 'announcements';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['published_at' => 'immutable_datetime', 'expires_at' => 'immutable_datetime', 'archived_at' => 'immutable_datetime', 'retracted_at' => 'immutable_datetime', 'revision' => 'integer'];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class, 'barangay_id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(AnnouncementHistory::class, 'announcement_id');
    }
}

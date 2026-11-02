<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Document extends Model
{
    use HasFactory;

    protected $table = 'documents';

    protected $guarded = ['*'];

    protected $hidden = ['disk', 'object_key'];

    protected function casts(): array
    {
        return ['bytes' => 'integer'];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(VerificationSubmission::class, 'submission_id');
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(PersonnelAppointment::class, 'appointment_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploader_id');
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('immutable_record'));
        static::deleting(fn () => throw new \LogicException('retained_record'));
    }
}

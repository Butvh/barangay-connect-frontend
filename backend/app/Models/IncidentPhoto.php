<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Private persistence. Public receipts/projections must be explicit P1 DTOs. */
class IncidentPhoto extends Model
{
    protected $guarded = ['*'];

    protected $visible = ['__private_metadata__'];

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected function casts(): array
    {
        return ['barangay_id' => 'integer', 'uploader_id' => 'integer', 'uploader_auth_version' => 'integer',
            'incident_id' => 'integer', 'bytes' => 'integer', 'cleanup_attempts' => 'integer',
            'created_at' => 'immutable_datetime', 'updated_at' => 'immutable_datetime',
            'uploaded_at' => 'immutable_datetime', 'expires_at' => 'immutable_datetime',
            'attached_at' => 'immutable_datetime', 'failed_at' => 'immutable_datetime',
            'removed_at' => 'immutable_datetime', 'cleanup_lease_until' => 'immutable_datetime'];
    }

    public function toArray(): array
    {
        return [];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploader_id');
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(EmergencyAlert::class, 'incident_id');
    }
}

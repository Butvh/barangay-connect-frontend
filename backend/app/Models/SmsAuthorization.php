<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Private append-only authority observations, never a provider receipt or public DTO. */
class SmsAuthorization extends Model
{
    protected $table = 'sms_authorizations';

    protected $guarded = ['*'];

    protected $visible = ['__private_metadata__'];

    public $timestamps = false;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected function casts(): array
    {
        return ['sms_delivery_id' => 'integer', 'attempt' => 'integer', 'recipient_id' => 'integer',
            'barangay_id' => 'integer', 'consent_revision' => 'integer', 'checked_at' => 'immutable_datetime'];
    }

    public function toArray(): array
    {
        return [];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('sms_authorizations_immutable'));
        static::deleting(fn () => throw new \LogicException('sms_authorizations_retained'));
    }
}

<?php

$v2 = static fn (string $resource, string $template, string $payload, ?string $sms = null, string $route = 'in_app') => [
    'version' => 2, 'resource' => $resource, 'template' => $template, 'payload_schema' => $payload,
    'in_app_template' => str_replace('.v2', '.in-app.v2', $template), 'sms_template' => $sms, 'route' => $route,
];

return [
    'sms' => [
        'enabled' => (bool) env('SMS_ENABLED', false),
        'key' => env('SEMAPHORE_API_KEY', ''),
        'sender' => env('SEMAPHORE_SENDER_NAME', ''),
        // Empty allowlist and zero budget deliberately disable all real sends.
        'allowlist' => array_values(array_filter(array_map('trim', explode(',', env('SMS_TEST_RECIPIENT_ALLOWLIST', ''))))),
        'daily_segment_budget' => (int) env('SMS_DAILY_SEGMENT_BUDGET', 0),
        'max_segments' => (int) env('SMS_MAX_SEGMENTS', 1),
        'destination_pepper' => env('SMS_DESTINATION_PEPPER', ''),
        'max_attempts' => 5,
        'timeout' => 15,
        'lease_seconds' => 90,
    ],
    'make' => [
        'enabled' => (bool) env('MAKE_ENABLED', false),
        'webhook_url' => env('MAKE_WEBHOOK_URL', ''),
        'webhook_api_key' => env('MAKE_WEBHOOK_API_KEY', ''),
        'credential_id' => env('MAKE_CREDENTIAL_ID', 'announcement-v1'),
        'command_token' => env('MAKE_COMMAND_TOKEN', ''),
        // One credential has one scope. Use separate deployments/credentials for additional scopes.
        'barangay_id' => (int) env('MAKE_BARANGAY_ID', 0),
        'window_seconds' => 300,
        'max_attempts' => 5,
    ],
    'events' => [
        // Explicit legacy definitions; no conversion of prototype data at dispatch.
        'alert.created.v1' => ['version' => 1, 'resource' => 'alert', 'template' => 'alert-review.v1', 'payload_schema' => 'empty', 'in_app_template' => 'alert-review.v1', 'sms_template' => 'alert-review.v1', 'route' => 'urgent'],
        'announcement.published.v1' => ['version' => 1, 'resource' => 'announcement', 'template' => 'announcement-review.v1', 'payload_schema' => 'empty', 'in_app_template' => 'announcement-review.v1', 'sms_template' => 'announcement-review.v1', 'route' => 'make'],
        // Canonical DBA contract candidate; P1/P2 adoption still requires review.
        'incident.created.v2' => $v2('incident', 'incident-created.v2', 'incident_created', 'alert-review.v1', 'urgent'),
        'incident.assigned.v2' => $v2('incident', 'incident-assigned.v2', 'incident_status'),
        'incident.status_changed.v2' => $v2('incident', 'incident-status-changed.v2', 'incident_status'),
        'incident.rescue_required.v2' => $v2('incident', 'incident-rescue-required.v2', 'incident_status'),
        'announcement.published.v2' => $v2('announcement', 'announcement-published.v2', 'empty', 'announcement-review.v1', 'make'),
        'feedback.submitted.v2' => $v2('feedback', 'feedback-submitted.v2', 'feedback_submitted'),
        'feedback.updated.v2' => $v2('feedback', 'feedback-updated.v2', 'feedback_updated'),
        'verification.updated.v2' => $v2('verification', 'verification-updated.v2', 'verification_status'),
        'personnel.updated.v2' => $v2('personnel_appointment', 'personnel-updated.v2', 'personnel_status'),
        'facility.updated.v2' => $v2('facility', 'facility-updated.v2', 'facility_status'),
        'security.updated.v2' => $v2('user', 'security-updated.v2', 'security_action'),
        'identity.resident_registered.v2' => $v2('user', 'identity-resident-registered.v2', 'empty'),
        'profile.updated.v2' => $v2('user', 'profile-updated.v2', 'empty'),
        'household.updated.v2' => $v2('household', 'household-updated.v2', 'empty'),
    ],
];

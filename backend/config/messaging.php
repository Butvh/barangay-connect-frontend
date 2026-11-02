<?php

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
        'alert.created.v1' => ['resource' => 'alert', 'template' => 'alert-review.v1', 'route' => 'urgent'],
        'announcement.published.v1' => ['resource' => 'announcement', 'template' => 'announcement-review.v1', 'route' => 'make'],
    ],
];

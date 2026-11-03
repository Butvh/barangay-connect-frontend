<?php

return [
    'connection' => 'mysql',
    'contract_version' => 1,
    // PHP interface version and persisted envelope version are different contracts.
    'event_envelope_version' => 2,
    'p2_enabled' => (bool) env('P2_MODULES_ENABLED', false),
    'dispatch_enabled' => (bool) env('OUTBOX_DISPATCH_ENABLED', false),
    // Set class names only in a reviewed integration PR after the owners supply compatible adapters.
    'store_adapter' => null,
    'reference_adapter' => null,
    'audit_adapter' => null,
    'outbox_adapter' => null,
    'notification_adapter' => null,
];

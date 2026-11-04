<?php

return [
    'connection' => 'mysql',
    'contract_version' => 1,
    // PHP interface version and persisted envelope version are different contracts.
    'event_envelope_version' => 2,
    'p2_enabled' => (bool) env('P2_MODULES_ENABLED', false),
    'dispatch_enabled' => (bool) env('OUTBOX_DISPATCH_ENABLED', false),
    'test_bindings' => (bool) env('P2_TEST_BINDINGS', false),
    'consent_test_bindings' => (bool) env('P1_CONSENT_TEST_BINDINGS', false),
    // Selection only, never default enablement. Provider requires an isolated disposable test context.
    'reviewed_test_adapters' => [
        'store_adapter' => 'App\\Services\\P2\\Persistence\\RelationalStore',
        'reference_adapter' => 'App\\Services\\P2\\Persistence\\ReferenceData',
        'audit_adapter' => 'App\\Services\\P2\\Persistence\\TypedAuditRecorder',
        'outbox_adapter' => 'App\\Services\\P2\\Persistence\\TypedOutboxWriter',
        'notification_adapter' => 'App\\Services\\P2\\Persistence\\InAppHandler',
    ],
    // Set class names only in a reviewed integration PR after the owners supply compatible adapters.
    'store_adapter' => null,
    'reference_adapter' => null,
    'audit_adapter' => null,
    'outbox_adapter' => null,
    'notification_adapter' => null,
];

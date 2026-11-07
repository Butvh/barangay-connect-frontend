<?php

return [
    'enabled' => (bool) env('IDENTITY_ENABLED', false),
    'pdfinfo_binary' => env('PDFINFO_BINARY'),
    'local_recovery_mail' => (bool) env('P1_LOCAL_RECOVERY_MAIL', false),
];

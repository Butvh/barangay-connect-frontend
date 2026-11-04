<?php

return [
    'default' => 'local',
    'disks' => [
        'private_incident_photos' => [
            'driver' => 'local', 'root' => storage_path('app/private/incident-photo-objects'),
            'visibility' => 'private', 'serve' => false, 'throw' => true, 'report' => false,
        ],
        'local' => [
            'driver' => 'local', 'root' => storage_path('app/private'),
            'visibility' => 'private', 'serve' => false, 'throw' => true, 'report' => false,
        ],
    ],
    // Downloads must pass an authorized controller; no public storage symlink.
    'links' => [],
];

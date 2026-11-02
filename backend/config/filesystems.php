<?php

return [
    'default' => 'local',
    'disks' => [
        'local' => [
            'driver' => 'local', 'root' => storage_path('app/private'),
            'visibility' => 'private', 'serve' => false, 'throw' => true, 'report' => false,
        ],
    ],
    // Downloads must pass an authorized controller; no public storage symlink.
    'links' => [],
];

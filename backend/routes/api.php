<?php

require __DIR__.'/identity.php';

// Team-owned slices register inside the same /api/v1 session boundary.
// Names are part of the proposed contract; do not implement their controllers here.
foreach (['civic-admin.php', 'incidents.php', 'community.php', 'notifications.php', 'reports.php', 'integrations.php'] as $file) {
    if (is_file(__DIR__.'/'.$file)) {
        require __DIR__.'/'.$file;
    }
}

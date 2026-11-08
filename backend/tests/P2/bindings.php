<?php

use App\Contracts\Events\AuditRecorder;
use App\Contracts\Events\OutboxWriter;
use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Services\Messaging\InAppNotificationHandler;
use App\Services\P2\Persistence\InAppHandler;
use App\Services\P2\Persistence\RelationalStore;
use App\Services\P2\Persistence\TypedAuditRecorder;
use App\Services\P2\Persistence\TypedOutboxWriter;

// Explicit reviewed-candidate bindings for the disposable composition only.
// Production binding selection belongs to P1's IntegrationServiceProvider.
foreach ([
    Store::class => RelationalStore::class,
    ReferenceData::class => App\Services\P2\Persistence\ReferenceData::class,
    AuditRecorder::class => TypedAuditRecorder::class,
    OutboxWriter::class => TypedOutboxWriter::class,
    InAppNotificationHandler::class => InAppHandler::class,
] as $port => $adapter) {
    $app->scoped($port, $adapter);
}

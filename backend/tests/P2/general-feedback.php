<?php

declare(strict_types=1);

// Real CivicService command regressions over the existing unit Store.
// This is contract preparation, not MySQL/HTTP or candidate acceptance.
spl_autoload_register(function (string $class): void {
    if (str_starts_with($class, 'App\\')) {
        $file = __DIR__.'/../../app/'.str_replace('\\', '/', substr($class, 4)).'.php';
        if (is_file($file)) {
            require $file;
        }
    }
});
require __DIR__.'/support.php';

use App\Services\Audit\AuditRecorder;
use App\Services\Civic\CivicService;
use App\Services\Messaging\OutboxWriter;
use App\Services\P2\Problem;

$passed = 0;
$failed = 0;
function gfCheck(string $name, Closure $test): void
{
    global $passed, $failed;
    try {
        $test();
        $passed++;
        echo "PASS $name\n";
    } catch (Throwable $error) {
        $failed++;
        echo "FAIL $name: {$error->getMessage()}\n";
    }
}
function gfEq(mixed $actual, mixed $expected): void
{
    if ($actual !== $expected) {
        throw new RuntimeException('Expected '.var_export($expected, true).', got '.var_export($actual, true));
    }
}
function gfDenied(Closure $work, string $code): void
{
    try {
        $work();
    } catch (Problem $error) {
        gfEq($error->errorCode, $code);

        return;
    }
    throw new RuntimeException('Expected '.$code);
}
function gfFixture(string $type = 'general'): array
{
    $store = new MemoryStore;
    $references = new References;
    $clock = fn () => '2026-11-08T08:00:00+00:00';
    $service = new CivicService($store, $references, new AuditRecorder($store, $clock), new OutboxWriter($store, $clock), $clock);
    $input = $type === 'general' ? ['type' => $type, 'rating' => 4, 'comment' => 'Complete original resident comment.'] : ['type' => $type, 'category' => 'Drainage', 'description' => 'Original concern', 'location' => 'Private Street'];
    $row = $service->submitFeedback($references->actorFor(1), $input, 'general-feedback-original');

    return [$store, $references, $service, $row];
}
function gfCommand(CivicService $service, References $references, string $action, int $actor, int $id, int $revision, string $key = 'general-feedback-action'): array
{
    $method = $action === 'review' ? 'reviewFeedback' : 'archiveFeedback';
    if (! method_exists($service, $method)) {
        throw new RuntimeException('Missing authorized General Feedback '.$action.' command');
    }

    return $service->$method($references->actorFor($actor), $id, ['expected_revision' => $revision], $key);
}

foreach ([2 => 'Secretary', 3 => 'Captain'] as $actor => $role) {
    gfCheck($role.' review preserves content and produces only one atomic audit/receipt', function () use ($actor) {
        [$s, $r, $c, $original] = gfFixture();
        $before = $s->rows;
        $result = gfCommand($c, $r, 'review', $actor, $original['id'], 0);
        gfEq($result['reviewed_by'], $actor);
        gfEq($result['reviewed_at'], '2026-11-08T08:00:00+00:00');
        gfEq($result['archived_at'], null);
        gfEq($result['revision'], 1);
        foreach (['rating', 'comment', 'resident_id', 'barangay_id', 'submitted_at', 'status', 'assigned_tanod_id'] as $field) {
            gfEq($result[$field], $original[$field]);
        }
        gfEq(count($s->rows['activity_logs']), count($before['activity_logs']) + 1);
        gfEq(count($s->rows['idempotency_requests']), count($before['idempotency_requests']) + 1);
        gfEq($s->rows['outbox_events'], $before['outbox_events']);
        gfEq(gfCommand($c, $r, 'review', $actor, $original['id'], 0), $result);
        gfEq(count($s->rows['activity_logs']), count($before['activity_logs']) + 1);
    });
    gfCheck($role.' archive is independent of review and retains resident history', function () use ($actor) {
        [$s, $r, $c, $row] = gfFixture();
        $archived = gfCommand($c, $r, 'archive', $actor, $row['id'], 0);
        gfEq($archived['archived_by'], $actor);
        gfEq($archived['reviewed_at'], null);
        gfEq($archived['status'], null);
        gfEq($c->feedback($r->actorFor($actor)), []);
        gfEq(count($c->feedback($r->actorFor($actor), ['archive' => 'all'])), 1);
        gfEq(count($c->feedback($r->actorFor($actor), ['archive' => 'only'])), 1);
        gfEq($c->feedbackItem($r->actorFor(1), $row['id'])['comment'], $row['comment']);
        gfEq(count($c->feedback($r->actorFor(1))), 1);
        gfDenied(fn () => $c->feedback($r->actorFor(1), ['archive' => 'all']), 'FORBIDDEN');
        gfDenied(fn () => $c->feedbackItem($r->actorFor(8), $row['id']), 'NOT_FOUND');
        gfDenied(fn () => gfCommand($c, $r, 'review', $actor, $row['id'], 1, 'review-archived-command'), 'INVALID_STATE');
    });
}
foreach (['review', 'archive'] as $action) {
    gfCheck($action.' denies other roles, foreign scope and wrong types without side effects', function () use ($action) {
        foreach ([1, 4, 5, 6, 8, 9] as $actor) {
            [$s, $r, $c, $row] = gfFixture();
            $before = $s->rows;
            gfDenied(fn () => gfCommand($c, $r, $action, $actor, $row['id'], 0), $actor === 9 ? 'NOT_FOUND' : ($actor === 6 ? 'AUTH' : 'FORBIDDEN'));
            gfEq($s->rows, $before);
        }
        foreach (['complaint', 'suggestion'] as $type) {
            [$s, $r, $c, $row] = gfFixture($type);
            $before = $s->rows;
            gfDenied(fn () => gfCommand($c, $r, $action, 2, $row['id'], 0), 'INVALID_STATE');
            gfEq($s->rows, $before);
        }
    });
    gfCheck($action.' rejects stale and repeated fresh intents, changed key body/resource/action', function () use ($action) {
        [$s, $r, $c, $row] = gfFixture();
        gfCommand($c, $r, $action, 2, $row['id'], 0);
        $before = $s->rows;
        gfDenied(fn () => gfCommand($c, $r, $action, 2, $row['id'], 0, 'fresh-stale-command'), 'CONFLICT');
        gfDenied(fn () => gfCommand($c, $r, $action, 2, $row['id'], 1, 'fresh-repeated-command'), 'INVALID_STATE');
        gfDenied(fn () => gfCommand($c, $r, $action, 2, $row['id'], 1), 'CONFLICT');
        gfDenied(fn () => gfCommand($c, $r, $action, 2, 999, 0), 'CONFLICT');
        gfDenied(fn () => gfCommand($c, $r, $action === 'review' ? 'archive' : 'review', 2, $row['id'], 0), 'CONFLICT');
        gfEq($s->rows, $before);
    });
    gfCheck($action.' rolls back markers/revision/receipt on audit or receipt storage failure', function () use ($action) {
        foreach (['activity_logs', 'idempotency_requests'] as $failTable) {
            [$s, $r, $c, $row] = gfFixture();
            $before = $s->rows;
            $s->failTable = $failTable;
            try {
                gfCommand($c, $r, $action, 2, $row['id'], 0);
                throw new LogicException('Expected injected storage failure');
            } catch (RuntimeException $error) {
                gfEq($error->getMessage(), 'Storage failure');
            }
            gfEq($s->rows, $before);
        }
    });
    gfCheck($action.' replay rechecks the originally observed current role', function () use ($action) {
        [$s, $r, $c, $row] = gfFixture();
        $actor = $r->actorFor(2);
        gfCommand($c, $r, $action, 2, $row['id'], 0);
        $before = $s->rows;
        $r->roles[2] = 'responder';
        $method = $action === 'review' ? 'reviewFeedback' : 'archiveFeedback';
        gfDenied(fn () => $c->$method($actor, $row['id'], ['expected_revision' => 0], 'general-feedback-action'), 'FORBIDDEN');
        gfEq($s->rows, $before);
    });
}
gfCheck('review then archive retains independent actors and authorized replay reads current DTO', function () {
    [$s, $r, $c, $row] = gfFixture();
    gfCommand($c, $r, 'review', 2, $row['id'], 0, 'review-first-command');
    $result = gfCommand($c, $r, 'archive', 3, $row['id'], 1, 'archive-next-command');
    gfEq($result['reviewed_by'], 2);
    gfEq($result['archived_by'], 3);
    gfEq($result['revision'], 2);
    gfEq(gfCommand($c, $r, 'review', 2, $row['id'], 0, 'review-first-command'), $result);
});

echo "General Feedback unit contracts: $passed passed, $failed failed\n";
exit($failed ? 1 : 0);

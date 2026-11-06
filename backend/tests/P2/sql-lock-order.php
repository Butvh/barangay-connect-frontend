<?php

use App\Models\CapacityGuard;
use Illuminate\Support\Facades\DB;

caseTest('Mutable eligibility rejects an undeclared person instead of expanding the lock set', function () use ($refs, $captain, $racePerson) {
    $person = $racePerson('responder');
    $rejected = false;
    DB::transaction(function () use ($refs, $captain, $person, &$rejected) {
        try {
            $refs->forActor($captain)->eligiblePerson($person->id, $person->barangayId);
        } catch (LogicException) {
            $rejected = true;
        }
    });
    verify($rejected, 'Eligibility acquired undeclared identity locks.');
});

caseTest('Actual assignment and resident details complete without an incident-to-resident lock cycle', function () use ($racePerson, $incidents, $captain) {
    $resident = $racePerson('resident');
    $responder = $racePerson('responder');
    $alert = $incidents->create($resident, [], 'lock-order-sos');
    DB::transaction(fn () => CapacityGuard::lockPeople([$resident->id, $responder->id, $captain->id]));
    $barrier = tempnam(sys_get_temp_dir(), 'p2-lock-order-');
    unlink($barrier);
    DB::beginTransaction();
    // A caller may already hold its resident identity row before invoking details().
    // Do not hold guard insert gap locks in the harness: those would hide the cycle.
    CapacityGuard::lockRows('users', [$resident->id]);
    $worker = proc_open([PHP_BINARY, __DIR__.'/sql-lock-worker.php', (string) $captain->id, (string) $alert['id'], (string) $responder->id, $barrier], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    verify(is_resource($worker), 'Could not start independent assignment service.');
    fclose($pipes[0]);
    $failure = null;
    try {
        $deadline = microtime(true) + 15;
        while (! is_file($barrier.'.held')) {
            if (! proc_get_status($worker)['running']) {
                throw new RuntimeException('Assignment exited before barrier: '.stream_get_contents($pipes[1]));
            }
            verify(microtime(true) < $deadline, 'Assignment did not reach the incident barrier. Trace: '.(is_file($barrier.'.trace') ? file_get_contents($barrier.'.trace') : 'none'));
            usleep(1000);
        }
        try {
            touch($barrier.'.release');
            $incidents->details($resident, $alert['id'], ['description' => 'Concurrent resident correction']);
            DB::commit();
        } catch (Throwable $error) {
            $failure = $error->getMessage();
            DB::rollBack();
        }
        $output = json_decode(stream_get_contents($pipes[1]), true, flags: JSON_THROW_ON_ERROR);
        $stderr = stream_get_contents($pipes[2]);
        verify($failure === null && isset($output['id']) && $stderr === '', 'Actual service lock cycle: '.($failure ?? $output['error'] ?? $stderr));
        verify(DB::table('alert_assignments')->where('alert_id', $alert['id'])->count() === 1, 'Assignment was not retained exactly once.');
        verify(DB::table('emergency_alerts')->where('id', $alert['id'])->value('description') === 'Concurrent resident correction', 'Resident correction was lost.');
    } finally {
        if (DB::transactionLevel() > 0) {
            DB::rollBack();
        }
        touch($barrier.'.release');
        foreach ($pipes as $pipe) {
            if (is_resource($pipe)) {
                fclose($pipe);
            }
        }
        if (proc_get_status($worker)['running']) {
            proc_terminate($worker);
        }
        proc_close($worker);
        foreach (['.held', '.release', '.trace'] as $suffix) {
            if (is_file($barrier.$suffix)) {
                unlink($barrier.$suffix);
            }
        }
    }
});

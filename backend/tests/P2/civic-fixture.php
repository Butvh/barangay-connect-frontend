<?php

// Own new-schema fixture. CLI credentials stay in caller memory, never evidence.
use App\Models\TanodMembership;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$db = DB::connection('mysql');
if (PHP_SAPI !== 'cli' || ! $app->environment('testing') || getenv('P1_COMBINED_TESTS') !== '1' || getenv('DB_TEST_DISPOSABLE') !== '1' ||
    ! preg_match('/^bc_dba_p1_civic_[a-zA-Z0-9_]+$/D', $db->getDatabaseName()) || $db->getDatabaseName() !== getenv('DB_TEST_DATABASE') ||
    ! in_array(config('database.connections.mysql.host'), ['127.0.0.1', 'localhost', '::1'], true) ||
    ! str_starts_with($db->selectOne('SELECT VERSION() AS v')->v, '8.4.') || getenv('SMS_ENABLED') !== 'false' || getenv('MAKE_ENABLED') !== 'false' || getenv('OUTBOX_DISPATCH_ENABLED') !== 'false') {
    throw new LogicException('Use a confirmed new local civic-only MySQL8.4 fixture with external delivery disabled.');
}
require_once __DIR__.'/civic-evidence.php';
$mode = $argv[1] ?? '';
if ($mode === 'prepare') {
    if ($db->table('users')->count() !== 0) {
        throw new LogicException('Existing data is never reset/reseeded.');
    }
    ob_start();
    require dirname(__DIR__).'/Support/browser-operational-fixture.php';
    $records = json_decode(ob_get_clean(), true, flags: JSON_THROW_ON_ERROR);
    $scope = User::findOrFail($records['people']['captain']['id'])->barangay_id;
    $foreignScope = User::findOrFail($records['people']['foreignResident']['id'])->barangay_id;
    foreach (['tanod', 'inactiveTanod', 'foreignTanod'] as $key) {
        $person = User::forceCreate(['barangay_id' => $key === 'foreignTanod' ? $foreignScope : $scope, 'full_name' => 'Civic QA '.$key,
            'email' => 'civic-qa-'.bin2hex(random_bytes(12)).'@example.invalid', 'password' => 'Unused'.bin2hex(random_bytes(24)), 'account_status' => 'Active']);
        TanodMembership::forceCreate(['user_id' => $person->id, 'barangay_id' => $person->barangay_id, 'active' => $key !== 'inactiveTanod']);
        $records[$key] = $person->id;
    }
    $password = 'Qa'.bin2hex(random_bytes(18)).'7';
    $foreign = User::forceCreate(['barangay_id' => $foreignScope, 'full_name' => 'Civic QA foreign Captain',
        'email' => 'civic-qa-'.bin2hex(random_bytes(12)).'@example.invalid', 'password' => Hash::make($password), 'account_status' => 'Active', 'is_captain' => true]);
    $records['people']['foreignCaptain'] = ['id' => $foreign->id, 'role' => 'captain', 'email' => $foreign->email, 'password' => $password];
    echo json_encode($records, JSON_THROW_ON_ERROR);
    exit;
}
if ($mode === 'state') {
    echo json_encode(['hashes' => civicDatabaseState(), 'feedback' => $db->table('community_feedback')->orderBy('id')->get(['id', 'kind as type', 'status', 'revision', 'rating', 'comment', 'description', 'assigned_tanod_id']),
        'announcements' => $db->table('announcements')->orderBy('id')->get(['id', 'title', 'status', 'revision']), 'history' => $db->table('announcement_history')->orderBy('id')->get(['announcement_id', 'action', 'reason'])], JSON_THROW_ON_ERROR);
    exit;
}
if (in_array($mode, ['membership', 'account'], true)) {
    $id = filter_var($argv[2] ?? '', FILTER_VALIDATE_INT);
    $person = User::whereKey($id)->where('email', 'like', 'civic-qa-%@example.invalid')->firstOrFail();
    if (! in_array($argv[3] ?? '', ['active', 'inactive'], true)) {
        throw new LogicException('Choose active or inactive.');
    }
    if ($mode === 'membership') {
        TanodMembership::where('user_id', $person->id)->update(['active' => $argv[3] === 'active']);
    } else {
        $person->forceFill(['account_status' => $argv[3] === 'active' ? 'Active' : 'Inactive'])->save();
    }
    exit;
}
if ($mode === 'expire') {
    $id = filter_var($argv[2] ?? '', FILTER_VALIDATE_INT);
    $row = $db->table('announcements')->where('id', $id)->where('title', 'like', 'Civic browser %')->first();
    if (! $row || $row->status !== 'Active') {
        throw new LogicException('Use a civic-owned active publication.');
    }
    $db->table('announcements')->where('id', $id)->update(['expires_at' => '2000-01-01 00:00:00']);
    exit;
}
throw new LogicException('Unknown civic fixture mode.');

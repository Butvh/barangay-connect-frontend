<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\Identity\PasswordRecovery;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

/** Explicitly executed only against a loopback SMTP sink and fictional demo mailboxes. */
final class DeliverLocalRecoveryCode implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 15;

    public function __construct(private string $challenge, private string $code) {}

    public function handle(PasswordRecovery $recovery): void
    {
        $recovery->available();
        $db = DB::connection(config('integration.connection'));
        if ($db->transactionLevel() !== 0) {
            throw new \LogicException('Recovery mail I/O must occur after the source transaction.');
        }
        $row = $db->table('password_recovery_challenges')->where('id', $this->challenge)->first();
        if (! $row || ! $row->user_id || $row->superseded_at || $row->verified_at || $row->consumed_at ||
            ! CarbonImmutable::parse($row->expires_at, 'UTC')->isAfter(now('UTC')) || ! hash_equals($row->code_digest, $recovery->digest($row->id.'|'.$this->code))) {
            return;
        }
        $user = User::on($db->getName())->with('appointment')->find($row->user_id);
        if (! $user || ! $recovery->portal($user, $row->email_digest) || ! str_ends_with($user->email, '@example.invalid')) {
            return; // No real recipient authorization is implied by this local implementation.
        }
        try {
            Mail::mailer('p1-local-recovery')->raw('Your Barangay Connect verification code is '.$this->code.'. It expires in 10 minutes. If you did not request it, ignore this message.',
                fn ($message) => $message->to($user->email)->subject('Barangay Connect account recovery'));
        } catch (\Throwable) {
            // Never persist SMTP details, addresses, message contents or codes in
            // failed-job exception strings. The encrypted payload stays private.
            throw new \RuntimeException('Local recovery mail could not be delivered.');
        }
    }
}

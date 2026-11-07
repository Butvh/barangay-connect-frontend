<?php

namespace App\Services\Verification;

use App\Contracts\Events\AuditRecorder;
use App\Contracts\Events\AuditSummary;
use App\Contracts\Events\ResourceReference;
use App\Services\Administration\AdministrativeContext;
use App\Services\Administration\CommandReceipt;
use App\Services\Identity\EffectiveIdentity;
use App\Support\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;

final class VerificationAdministration
{
    private const ROLES = ['resident', 'captain', 'secretary'];

    public function __construct(private AdministrativeContext $context, private PrivateDocumentUploads $documents, private CommandReceipt $receipts) {}

    private function row(EffectiveIdentity $actor, int $id, bool $lock = false): object
    {
        $row = $this->context->db()->table('verifications')->where('id', $id)->where('barangay_id', $actor->barangayId)
            ->when($actor->role === 'resident', fn ($q) => $q->where('resident_id', $actor->id))
            ->when($lock, fn ($q) => $q->lockForUpdate())->first();

        return $row ?? throw new ApiProblem('NOT_FOUND', 404, 'Verification is unavailable.');
    }

    private function iso(?string $value): ?string
    {
        return $value === null ? null : CarbonImmutable::parse($value, 'UTC')->toISOString();
    }

    private function project(object $row): array
    {
        $db = $this->context->db();
        $resident = $db->table('users')->where('id', $row->resident_id)->first(['id', 'full_name', 'household_id', 'contact_number']);
        $household = $resident?->household_id ? $db->table('households')->where('id', $resident->household_id)->where('barangay_id', $row->barangay_id)->first(['id', 'address', 'map_x', 'map_y', 'revision']) : null;
        $submissions = $db->table('verification_submissions')->where('verification_id', $row->id)->orderBy('revision')->get();
        $logs = $db->table('activity_logs')->where(['resource_type' => 'verification', 'resource_id' => $row->id, 'barangay_id' => $row->barangay_id])->orderBy('id')->get();
        $versions = [];
        foreach ($submissions as $ordinal => $submission) {
            $docs = $db->table('documents')->where('submission_id', $submission->id)->orderBy('id')->get(['id', 'original_name', 'kind', 'mime', 'bytes']);
            $submitted = $logs->first(function ($log) use ($submission) {
                $s = json_decode($log->summary, true, flags: JSON_THROW_ON_ERROR);

                return in_array($log->action, ['Submitted', 'Resubmitted'], true) && ($s['revision'] ?? null) === (int) $submission->revision;
            });
            $summary = $submitted ? json_decode($submitted->summary, true, flags: JSON_THROW_ON_ERROR) : [];
            $versions[(int) $submission->revision] = ['submission_id' => (int) $submission->id, 'submission_number' => $ordinal + 1,
                'document_type' => $summary['reason'] ?? 'Valid ID and proof of residence', 'file_name' => $docs->pluck('original_name')->implode('; '),
                'documents' => $docs->map(fn ($doc) => ['id' => (int) $doc->id, 'name' => $doc->original_name, 'kind' => $doc->kind, 'mime' => $doc->mime, 'bytes' => (int) $doc->bytes,
                    'download_path' => '/api/v1/private-documents/'.$doc->id])->all(),
                'submitted_at' => $this->iso($submission->submitted_at), 'deadline_at' => CarbonImmutable::parse($submission->submitted_at, 'UTC')->addDays(7)->toISOString()];
        }
        $current = collect($versions)->first(fn ($v) => $v['submission_id'] === (int) $row->current_submission_id);
        $history = [];
        foreach ($logs as $log) {
            $summary = json_decode($log->summary, true, flags: JSON_THROW_ON_ERROR);
            $version = null;
            foreach ($versions as $revision => $candidate) {
                if ($revision <= ($summary['revision'] ?? -1)) {
                    $version = $candidate;
                }
            }
            $history[] = ['action' => $log->action, 'at' => $this->iso($log->occurred_at), 'actor_id' => $log->actor_id,
                'actor_name' => $log->actor_name, 'actor_role' => $log->role_at_action,
                'reason' => in_array($log->action, ['Rejected', 'Resubmission requested'], true) ? ($summary['reason'] ?? '') : ''] + ($version ?? []);
        }

        return ['id' => (int) $row->id, 'user_id' => (int) $row->resident_id, 'barangay_id' => (int) $row->barangay_id,
            'resident' => $resident ? ['id' => (int) $resident->id, 'full_name' => $resident->full_name, 'contact_number' => $resident->contact_number] : null,
            'household' => $household ? (array) $household : null, 'review_status' => $row->review_status, 'revision' => (int) $row->revision,
            'reviewed_by' => $row->reviewer_id === null ? null : (int) $row->reviewer_id, 'reviewed_at' => $this->iso($row->reviewed_at),
            'rejection_reason' => $row->rejection_reason, 'resubmission_reason' => $row->correction_reason,
            'correction_requested_at' => $this->iso($row->correction_requested_at), 'history' => $history,
            'deadline_at' => $this->iso($row->deadline_at), 'submitted_at' => $current['submitted_at'] ?? null,
            'document_type' => $current['document_type'] ?? 'Not recorded', 'file_name' => $current['file_name'] ?? '',
            'submission_number' => $current['submission_number'] ?? 0, 'documents' => $current['documents'] ?? [],
            'created_at' => $this->iso($row->created_at), 'updated_at' => $this->iso($row->updated_at)];
    }

    public function get(EffectiveIdentity $actor, int $id): array
    {
        return $this->context->transaction($actor, self::ROLES, [], fn () => $this->project($this->row($actor, $id)));
    }

    public function list(EffectiveIdentity $actor, array $options = []): array
    {
        return $this->context->transaction($actor, self::ROLES, [], function () use ($actor, $options) {
            $db = $this->context->db();
            $latest = $db->table('verifications')->where('barangay_id', $actor->barangayId)->selectRaw('MAX(id)')->groupBy('resident_id');

            return $db->table('verifications')->whereIn('id', $latest)->where('barangay_id', $actor->barangayId)
                ->when($actor->role === 'resident', fn ($q) => $q->where('resident_id', $actor->id))
                ->when(! empty($options['status']), fn ($q) => $q->where('review_status', $options['status']))
                ->orderByDesc('id')->get()->map(fn ($row) => $this->project($row))->all();
        });
    }

    public function submit(EffectiveIdentity $actor, ?int $id, array $input, UploadedFile $validId, UploadedFile $proof, string $key): array
    {
        if (! preg_match('/^[A-Za-z0-9_-]{8,128}$/D', $key)) {
            throw new ApiProblem('VALIDATION', 422, 'Use a valid original command key.');
        }
        if ($actor->role !== 'resident') {
            throw new ApiProblem('FORBIDDEN', 403, 'Only a resident can submit their own documents.');
        }
        $rules = ['document_type' => 'required|string|max:100'];
        if ($id !== null) {
            $rules['expected_revision'] = 'required|integer|min:0';
        }
        $fields = $this->context->validate($input, $rules);
        if (trim($fields['document_type']) === '' || ($id !== null && ! is_int($fields['expected_revision']))) {
            throw new ApiProblem('VALIDATION', 422, 'Use a document type and original revision.');
        }
        $staged = [];
        try {
            $staged[] = $this->documents->stage($validId, 10485760, 'valid_id');
            $staged[] = $this->documents->stage($proof, 10485760, 'proof_of_residence');
            $outcome = $this->context->transaction($actor, ['resident'], [], function () use ($actor, $id, $fields, $staged, $key): array {
                $body = ['application' => $id, 'document_type' => trim($fields['document_type']), 'revision' => $fields['expected_revision'] ?? null,
                    'files' => array_map(fn ($f) => array_intersect_key($f, array_flip(['input_sha256', 'original_name', 'kind'])), $staged)];

                return $this->receipts->once($actor->id, 'p1:verification.submit', $key, $body, function () use ($actor, $id, $fields, $staged): array {
                    $db = $this->context->db();
                    $latest = $db->table('verifications')->where('resident_id', $actor->id)->where('barangay_id', $actor->barangayId)->orderByDesc('id')->lockForUpdate()->first();
                    if ($id === null) {
                        if ($latest && ! in_array($latest->review_status, ['Rejected', 'Expired'], true)) {
                            throw new ApiProblem('CONFLICT', 409, 'Continue your current verification application.');
                        }
                        $application = $db->table('verifications')->insertGetId(['resident_id' => $actor->id, 'barangay_id' => $actor->barangayId,
                            'review_status' => 'Pending', 'created_at' => now('UTC'), 'updated_at' => now('UTC')]);
                        $revision = 1;
                        $action = 'Submitted';
                    } else {
                        if (! $latest || (int) $latest->id !== $id || ! in_array($latest->review_status, ['Pending', 'Resubmission requested'], true)) {
                            throw new ApiProblem('CONFLICT', 409, 'This application cannot accept replacement documents.');
                        }
                        $this->context->revision($latest, $fields['expected_revision']);
                        if ($latest->review_status === 'Pending' && $this->expireLocked($actor, $latest)) {
                            return ['id' => $id, 'expired' => true];
                        }
                        $application = $id;
                        $revision = (int) $latest->revision + 1;
                        $action = 'Resubmitted';
                    }
                    $now = now('UTC');
                    $submission = $db->table('verification_submissions')->insertGetId(['verification_id' => $application, 'barangay_id' => $actor->barangayId,
                        'revision' => $revision, 'submitted_at' => $now]);
                    foreach ($staged as $file) {
                        $this->documents->attach($file, $actor->barangayId, $actor->id, submission: $submission);
                    }
                    $db->table('verifications')->where('id', $application)->update(['current_submission_id' => $submission, 'review_status' => 'Pending',
                        'deadline_at' => $now->copy()->addDays(7), 'revision' => $revision, 'reviewer_id' => null, 'reviewed_at' => null,
                        'rejection_reason' => null, 'correction_reason' => null, 'correction_requested_at' => null, 'updated_at' => $now]);
                    $this->context->record($actor, 'verification', $application, 'verification.updated.v2', ['status' => 'Pending'], $action,
                        ['status' => 'Pending', 'revision' => $revision, 'reason' => trim($fields['document_type'])], [$actor->id, ...$this->context->administrators($actor->barangayId)]);

                    return ['id' => $application];
                });
            });
        } finally {
            foreach ($staged as $file) {
                $this->documents->release($file);
            }
        }
        if ($outcome['expired'] ?? false) {
            throw new ApiProblem('CONFLICT', 409, 'The review deadline elapsed. Start a new application.');
        }

        return $this->get($actor, $outcome['id']);
    }

    private function expireLocked(EffectiveIdentity $actor, object $row): bool
    {
        if ($row->review_status !== 'Pending' || $row->deadline_at === null || CarbonImmutable::parse($row->deadline_at, 'UTC')->isAfter(now('UTC'))) {
            return false;
        }
        $revision = (int) $row->revision + 1;
        $this->context->db()->table('verifications')->where('id', $row->id)->update(['review_status' => 'Expired', 'revision' => $revision, 'updated_at' => now('UTC')]);
        // Expiry is system evidence, even when a resident or official discovers it.
        app(AuditRecorder::class)->record(null, null, $actor->barangayId, new ResourceReference('verification', (int) $row->id), 'Expired', new AuditSummary(['status' => 'Expired', 'revision' => $revision]));
        $this->context->event($actor, (int) $row->id, 'verification.updated.v2', ['status' => 'Expired'], [(int) $row->resident_id, ...$this->context->administrators($actor->barangayId)]);

        return true;
    }

    public function review(EffectiveIdentity $actor, int $id, array $input): array
    {
        $fields = $this->context->validate($input, ['decision' => 'required|in:Approved,Rejected,Resubmission requested', 'reason' => 'nullable|string|max:1000', 'expected_revision' => 'required|integer|min:0']);
        $reason = trim($fields['reason'] ?? '');
        if (! is_int($fields['expected_revision']) || ($fields['decision'] !== 'Approved' && $reason === '')) {
            throw new ApiProblem('VALIDATION', 422, 'Use the original revision and provide the required reason.');
        }
        $observed = $this->row($actor, $id);
        $expired = $this->context->transaction($actor, ['captain', 'secretary'], ['person:'.$observed->resident_id], function () use ($actor, $id, $fields, $reason) {
            $db = $this->context->db();
            $row = $this->row($actor, $id, true);
            $this->context->revision($row, $fields['expected_revision']);
            $latest = $db->table('verifications')->where('resident_id', $row->resident_id)->where('barangay_id', $actor->barangayId)->max('id');
            if ((int) $latest !== $id || $row->review_status !== 'Pending' || $row->current_submission_id === null || $row->deadline_at === null) {
                throw new ApiProblem('CONFLICT', 409, 'Only the latest pending submission can be reviewed.');
            }
            if ($this->expireLocked($actor, $row)) {
                return true;
            }
            $status = $fields['decision'];
            $revision = (int) $row->revision + 1;
            $db->table('verifications')->where('id', $id)->update(['review_status' => $status, 'revision' => $revision,
                'reviewer_id' => $actor->id, 'reviewed_at' => $status === 'Resubmission requested' ? null : now('UTC'),
                'correction_requested_at' => $status === 'Resubmission requested' ? now('UTC') : null,
                'correction_reason' => $status === 'Resubmission requested' ? $reason : null,
                'rejection_reason' => $status === 'Rejected' ? $reason : null, 'updated_at' => now('UTC')]);
            $this->context->record($actor, 'verification', $id, 'verification.updated.v2', ['status' => $status], $status,
                ['status' => $status, 'revision' => $revision] + ($reason !== '' ? ['reason' => $reason] : []), [(int) $row->resident_id, ...$this->context->administrators($actor->barangayId)]);

            return false;
        });
        if ($expired) {
            throw new ApiProblem('CONFLICT', 409, 'The review deadline elapsed. The application is now Expired.');
        }

        return $this->get($actor, $id);
    }

    public function expireOverdue(EffectiveIdentity $actor): int
    {
        $this->context->identity->assertCurrent($actor);
        if (! in_array($actor->role, self::ROLES, true)) {
            throw new ApiProblem('FORBIDDEN', 403, 'Verification is unavailable for this role.');
        }
        $rows = $this->context->db()->table('verifications')->where('barangay_id', $actor->barangayId)->where('review_status', 'Pending')
            ->where('deadline_at', '<=', now('UTC'))->when($actor->role === 'resident', fn ($q) => $q->where('resident_id', $actor->id))->orderBy('id')->limit(100)->get();
        $count = 0;
        foreach ($rows as $row) {
            $count += (int) $this->context->transaction($actor, self::ROLES, ['person:'.$row->resident_id], fn () => $this->expireLocked($actor, $this->row($actor, (int) $row->id, true)));
        }

        return $count;
    }

    public function document(EffectiveIdentity $actor, int $id): object
    {
        return $this->context->transaction($actor, self::ROLES, [], function () use ($actor, $id) {
            $db = $this->context->db();
            $doc = $db->table('documents')->where('id', $id)->where('barangay_id', $actor->barangayId)->first();
            if (! $doc || $doc->submission_id === null) {
                throw new ApiProblem('NOT_FOUND', 404, 'Private document is unavailable.');
            }
            $submission = $db->table('verification_submissions')->where('id', $doc->submission_id)->where('barangay_id', $actor->barangayId)->first();
            if (! $submission) {
                throw new ApiProblem('NOT_FOUND', 404, 'Private document is unavailable.');
            }
            $this->row($actor, (int) $submission->verification_id);

            return $doc;
        });
    }
}

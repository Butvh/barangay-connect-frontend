<?php

namespace App\Services\Photos;

use App\Contracts\P2\IncidentPhotoAuthorization;
use App\Contracts\P2\Store;
use App\Contracts\Photos\IncidentPhotos;
use App\Contracts\Photos\StagedIncidentPhoto;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\SourceReferences;
use App\Support\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Database\Connection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** Actual private bytes; caller source commands remain P2-owned. */
final class PrivateIncidentPhotos implements IncidentPhotos
{
    public function __construct(private Store $store, private IncidentPhotoAuthorization $policy,
        private IdentityReferences $identity, private SourceReferences $sources,
        private PhotoInspector $inspector, private PrivatePhotoObjects $objects) {}

    private function db(): Connection
    {
        $db = DB::connection(config('integration.connection', 'mysql'));
        if ($db->getName() !== config('database.default') || $db->getDriverName() !== 'mysql') {
            throw new \LogicException('Private photos require the shared named MySQL connection.');
        }

        return $db;
    }

    private function outside(): void
    {
        if ($this->db()->transactionLevel() !== 0) {
            throw new \LogicException('Private byte I/O must start outside a transaction.');
        }
    }

    private function owner(EffectiveIdentity $actor): void
    {
        $this->identity->locked($actor);
        if ($actor->role !== 'resident' || ! $this->sources->approved($actor, $actor->id, true)) {
            throw new ApiProblem('FORBIDDEN', 403, 'Current approved residency is required.');
        }
    }

    private function receipt(object $row, EffectiveIdentity $actor): StagedIncidentPhoto
    {
        return new StagedIncidentPhoto($row->upload_id, $actor, $row->mime, (int) $row->bytes, new \DateTimeImmutable($row->expires_at, new \DateTimeZone('UTC')));
    }

    public function stage(EffectiveIdentity $observed, UploadedFile $photo, string $intentKey): StagedIncidentPhoto
    {
        $this->outside();
        if (! preg_match('/^[A-Za-z0-9._:-]{8,160}$/D', $intentKey)) {
            throw new ApiProblem('VALIDATION', 422, 'A stable upload intent is required.');
        }
        // Authenticate before reading uploaded bytes; allocation happens only after this guard.
        $this->store->transaction(['person:'.$observed->id], fn () => $this->owner($observed));
        if (! $photo->isValid() || ! is_file($photo->getPathname()) || $photo->getSize() < 1 || $photo->getSize() > 10485760) {
            throw new ApiProblem('PHOTO_INVALID', 422, 'Choose a valid photo within the upload limit.');
        }
        $input = file_get_contents($photo->getPathname(), false, null, 0, 10485761);
        if ($input === false || strlen($input) > 10485760) {
            throw new ApiProblem('PHOTO_INVALID', 422, 'Choose a valid photo within the upload limit.');
        }
        $digest = hash_hmac('sha256', 'incident-photo:'.$intentKey, (string) config('app.key'));
        $inputHash = hash('sha256', $input);
        [$row, $created] = $this->store->transaction(['person:'.$observed->id], function () use ($observed, $digest, $inputHash): array {
            $this->owner($observed);
            $generation = $observed->sessionSnapshot()['identity_version'];
            $rows = $this->db()->table('incident_photos');
            $row = (clone $rows)->where('uploader_id', $observed->id)->where('barangay_id', $observed->barangayId)
                ->where('uploader_auth_version', $generation)->where('intent_digest', $digest)->lockForUpdate()->first();
            if ($row) {
                if (! hash_equals($row->input_sha256, $inputHash)) {
                    throw new ApiProblem('PHOTO_CONFLICT', 409, 'This upload intent already has different photo bytes.');
                }
                if (! in_array($row->state, ['ready', 'attached'], true) || ($row->state !== 'attached' && $row->expires_at <= CarbonImmutable::now('UTC')->format('Y-m-d H:i:s.u'))) {
                    throw new ApiProblem($row->state === 'processing' ? 'PHOTO_PROCESSING' : 'PHOTO_NOT_FOUND', $row->state === 'processing' ? 503 : 404, 'This upload is not ready or is no longer available.');
                }

                return [$row, false];
            }
            $now = CarbonImmutable::now('UTC');
            $random = bin2hex(random_bytes(32));
            $id = $rows->insertGetId(['upload_id' => (string) Str::uuid(), 'uploader_id' => $observed->id, 'barangay_id' => $observed->barangayId,
                'uploader_auth_version' => $generation, 'intent_digest' => $digest, 'input_sha256' => $inputHash,
                'disk' => 'private_incident_photos', 'object_key' => 'incident-photos/'.substr($random, 0, 2).'/'.$random,
                'state' => 'processing', 'created_at' => $now, 'updated_at' => $now, 'expires_at' => $now->addDay()]);

            return [$rows->where('id', $id)->first(), true];
        });
        if (! $created) {
            $this->objects->verified($row);

            return $this->receipt($row, $observed);
        }
        try {
            $output = $this->inspector->inspect($input);
            $this->objects->put($row->object_key, $output['content']);
        } catch (ApiProblem $error) {
            $this->db()->table('incident_photos')->where('id', $row->id)->where('state', 'processing')
                ->update(['state' => 'failed', 'failure_code' => $error->status === 422 ? 'invalid_image' : 'storage_failed', 'failed_at' => now('UTC'), 'updated_at' => now('UTC')]);
            throw $error;
        }
        event(new PhotoStored((int) $row->id));
        // If this commit fails/crashes, processing metadata retains the private orphan key for cleanup.
        $ready = $this->store->transaction(['person:'.$observed->id], function () use ($observed, $row, $output): object {
            $this->owner($observed);
            $current = $this->db()->table('incident_photos')->where('id', $row->id)->lockForUpdate()->first();
            if ($current->state !== 'processing' || $current->expires_at <= CarbonImmutable::now('UTC')->format('Y-m-d H:i:s.u')) {
                throw new ApiProblem('PHOTO_NOT_FOUND', 404, 'This upload is no longer available.');
            }
            $this->db()->table('incident_photos')->where('id', $row->id)->update(['state' => 'ready', 'mime' => $output['mime'],
                'bytes' => $output['bytes'], 'sha256' => $output['sha256'], 'uploaded_at' => now('UTC'), 'updated_at' => now('UTC')]);

            return $this->db()->table('incident_photos')->where('id', $row->id)->first();
        });

        return $this->receipt($ready, $observed);
    }

    public function attach(EffectiveIdentity $observed, string $uploadId, int $incidentId, int $expectedRevision): int
    {
        // Actual policy asserts declared caller guards/current identity/source/revision before metadata.
        $this->policy->assertAttach($observed, $incidentId, $expectedRevision);
        $row = $this->db()->table('incident_photos')->where('upload_id', $uploadId)->where('uploader_id', $observed->id)
            ->where('barangay_id', $observed->barangayId)->lockForUpdate()->first();
        if (! $row || (int) $row->uploader_auth_version !== $observed->sessionSnapshot()['identity_version'] ||
            $row->state !== 'ready' || $row->expires_at <= CarbonImmutable::now('UTC')->format('Y-m-d H:i:s.u') || $row->cleanup_token !== null) {
            throw new ApiProblem('PHOTO_NOT_FOUND', 404, 'This upload is not available for attachment.');
        }
        $this->db()->table('incident_photos')->where('id', $row->id)->update(['state' => 'attached', 'incident_id' => $incidentId,
            'attached_at' => now('UTC'), 'updated_at' => now('UTC')]);

        return (int) $row->id;
    }

    public function download(EffectiveIdentity $observed, int $photoId): BinaryFileResponse
    {
        $this->outside();
        $row = $this->db()->table('incident_photos')->where('id', $photoId)->where('barangay_id', $observed->barangayId)->where('state', 'attached')->first();
        if (! $row) {
            throw new ApiProblem('PHOTO_NOT_FOUND', 404, 'This photo is not available.');
        }
        $this->policy->assertDownload($observed, (int) $row->incident_id);
        $path = $this->objects->verified($row);

        return response()->download($path, 'incident-photo-'.$row->id.($row->mime === 'image/png' ? '.png' : '.jpg'),
            ['Content-Type' => $row->mime, 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
}

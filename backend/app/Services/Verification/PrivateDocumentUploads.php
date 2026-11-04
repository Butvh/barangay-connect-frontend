<?php

namespace App\Services\Verification;

use App\Services\Photos\PhotoInspector;
use App\Support\ApiProblem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;

/** Actual private ID/proof/personnel bytes; staging and removal stay outside source transactions. */
final class PrivateDocumentUploads
{
    public function __construct(private PhotoInspector $images) {}

    private function outside(): void
    {
        if (DB::connection(config('integration.connection', 'mysql'))->transactionLevel() !== 0) {
            throw new \LogicException('Private document I/O must occur outside a source transaction.');
        }
    }

    public function path(string $key): string
    {
        if (! preg_match('~^documents/[a-f0-9]{2}/[a-f0-9]{64}-[a-f0-9]{64}$~D', $key)) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Private document integrity failed.');
        }
        $root = storage_path('app/private/document-objects');
        $path = str_replace('\\', '/', $root).'/'.$key;
        $probe = '';
        foreach (explode('/', $path) as $part) {
            $probe .= $part.'/';
            if (is_link(rtrim($probe, '/'))) {
                throw new ApiProblem('NOT_AVAILABLE', 503, 'Private document integrity failed.');
            }
        }

        return $path;
    }

    public function stage(UploadedFile $file, int $limit, string $kind): array
    {
        $this->outside();
        if (! $file->isValid() || $file->getSize() < 1 || $file->getSize() > $limit) {
            throw new ApiProblem('VALIDATION', 422, 'Choose an actual supported document within the file limit.');
        }
        $input = file_get_contents($file->getPathname(), false, null, 0, $limit + 1);
        $mime = $input ? (new \finfo(FILEINFO_MIME_TYPE))->buffer($input) : false;
        if (! $input || strlen($input) > $limit || ! in_array($mime, ['image/jpeg', 'image/png', 'application/pdf'], true)) {
            throw new ApiProblem('VALIDATION', 422, 'Choose a valid JPEG, PNG or PDF document.');
        }
        if ($mime === 'application/pdf') {
            $binary = config('identity.pdfinfo_binary');
            if (! is_string($binary) || ! is_executable($binary)) {
                throw new ApiProblem('NOT_AVAILABLE', 503, 'Private PDF inspection is unavailable.');
            }
            $inspect = new Process([$binary, '-']);
            $inspect->setInput($input)->setTimeout(10);
            try {
                $inspect->run(function ($type, $data) use ($inspect): void {
                    if (strlen($inspect->getOutput()) + strlen($inspect->getErrorOutput()) > 16384) {
                        $inspect->stop(0);
                    }
                });
            } catch (ProcessTimedOutException) {
                throw new ApiProblem('VALIDATION', 422, 'This PDF could not be safely inspected.');
            }
            if (! $inspect->isSuccessful() || ! str_starts_with($input, '%PDF-') || ! str_contains(substr($input, -1024), '%%EOF')) {
                throw new ApiProblem('VALIDATION', 422, 'This PDF could not be safely inspected.');
            }
            $output = $input;
        } else {
            $output = $this->images->inspect($input)['content'];
        }
        if (strlen($output) > $limit) {
            throw new ApiProblem('VALIDATION', 422, 'The inspected document exceeds the file limit.');
        }
        $random = bin2hex(random_bytes(32));
        $key = 'documents/'.substr($random, 0, 2).'/'.$random.'-'.hash('sha256', $output);
        $path = $this->path($key);
        if (! is_dir(dirname($path)) && ! mkdir(dirname($path), 0700, true) && ! is_dir(dirname($path))) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Private document storage is unavailable.');
        }
        $stream = @fopen($this->path($key), 'x+b');
        if (! $stream) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Private document storage is unavailable.');
        }
        try {
            chmod($path, 0600);
            $offset = 0;
            while ($offset < strlen($output)) {
                $written = fwrite($stream, substr($output, $offset));
                if (! $written) {
                    throw new ApiProblem('NOT_AVAILABLE', 503, 'Private document storage is unavailable.');
                }
                $offset += $written;
            }
            fflush($stream);
            if (function_exists('fsync')) {
                fsync($stream);
            }
            // Fresh objects cannot enter the 24-hour cleanup window. Acquire the
            // cross-transaction lease only after writing, including on Windows.
            if (! flock($stream, LOCK_SH)) {
                throw new ApiProblem('NOT_AVAILABLE', 503, 'Private document lease is unavailable.');
            }
        } catch (\Throwable $error) {
            fclose($stream);
            throw $error;
        }
        $name = preg_replace('/[\x00-\x1f\x7f]/u', '', basename(str_replace('\\', '/', $file->getClientOriginalName())));

        return ['disk' => 'local', 'object_key' => $key, 'original_name' => mb_substr($name ?: 'document', 0, 200),
            'mime' => $mime, 'bytes' => strlen($output), 'kind' => $kind, 'input_sha256' => hash('sha256', $input), 'lease' => $stream];
    }

    public function attach(array $staged, int $scope, int $uploader, ?int $submission = null, ?int $appointment = null): int
    {
        $db = DB::connection(config('integration.connection', 'mysql'));
        if ($db->transactionLevel() < 1 || ! is_resource($staged['lease'] ?? null) || ($submission === null) === ($appointment === null)) {
            throw new \LogicException('A source transaction, owned stage lease and exact document association are required.');
        }

        return $db->table('documents')->insertGetId(array_intersect_key($staged, array_flip(['disk', 'object_key', 'original_name', 'mime', 'bytes', 'kind'])) +
            ['barangay_id' => $scope, 'uploader_id' => $uploader, 'submission_id' => $submission, 'appointment_id' => $appointment, 'created_at' => now('UTC'), 'updated_at' => now('UTC')]);
    }

    public function release(array $staged): void
    {
        $this->outside();
        if (is_resource($staged['lease'] ?? null)) {
            flock($staged['lease'], LOCK_UN);
            fclose($staged['lease']);
        }
    }

    public function verified(object $row): string
    {
        $this->outside();
        $path = $this->path($row->object_key);
        $expected = substr($row->object_key, -64);
        $actual = is_file($path) ? @hash_file('sha256', $path) : false;
        if (! is_string($actual) || ! hash_equals($expected, $actual) || filesize($path) !== (int) $row->bytes) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Private document integrity failed.');
        }

        return $path;
    }

    /** Bounded local orphan reclamation, never scheduled or enabled implicitly. */
    public function cleanup(int $limit = 50): array
    {
        $this->outside();
        $limit = max(1, min(100, $limit));
        $root = storage_path('app/private/document-objects/documents');
        $result = ['scanned' => 0, 'examined' => 0, 'removed' => 0, 'retained' => 0];
        if (! is_dir($root) || is_link($root)) {
            return $result;
        }
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS));
        foreach ($files as $file) {
            if ($result['scanned'] >= $limit * 20) {
                break;
            }
            $result['scanned']++;
            if ($file->isLink() || ! $file->isFile() || $file->getMTime() > time() - 86400) {
                continue;
            }
            $key = 'documents/'.str_replace('\\', '/', substr($file->getPathname(), strlen($root) + 1));
            if (! preg_match('~^documents/[a-f0-9]{2}/[a-f0-9]{64}-[a-f0-9]{64}$~D', $key)) {
                continue;
            }
            $path = $this->path($key);
            if (++$result['examined'] > $limit) {
                $result['examined']--;
                break;
            }
            $lease = @fopen($path, 'r+b');
            if (! $lease) {
                $result['retained']++;

                continue;
            }
            try {
                if (! flock($lease, LOCK_EX | LOCK_NB)) {
                    $result['retained']++;

                    continue;
                }
                // Source attachment holds a shared lease through its commit. A
                // database error aborts cleanup rather than implying no reference.
                $attached = DB::connection(config('integration.connection', 'mysql'))->table('documents')->where('disk', 'local')->where('object_key', $key)->exists();
                if ($attached || filemtime($path) > time() - 86400) {
                    $result['retained']++;
                } elseif (PHP_OS_FAMILY !== 'Windows' && @unlink($path)) {
                    $result['removed']++;
                } else {
                    // Windows cannot atomically unlink an open leased file.
                    // Retain it; never release the lease before deletion.
                    $result['retained']++;
                }
            } finally {
                fclose($lease);
            }
        }

        return $result;
    }
}

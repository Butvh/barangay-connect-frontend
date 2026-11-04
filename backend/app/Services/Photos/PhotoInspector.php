<?php

namespace App\Services\Photos;

use App\Support\ApiProblem;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;

/** Decode in a bounded child process, never inside a SQL transaction. */
final class PhotoInspector
{
    public function inspect(string $input): array
    {
        $shape = strlen($input) > 0 && strlen($input) <= 10485760 ? @getimagesizefromstring($input) : false;
        if (! $shape || ! in_array($shape[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true) ||
            $shape[0] < 1 || $shape[1] < 1 || max($shape[0], $shape[1]) > 8192 || $shape[0] * $shape[1] > 16000000) {
            throw new ApiProblem('PHOTO_INVALID', 422, 'Choose a valid JPEG or PNG within the photo limits.');
        }
        if (! extension_loaded('gd')) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Photo inspection is unavailable.');
        }
        $process = new Process([PHP_BINARY, '-d', 'memory_limit=256M', '-d', 'max_execution_time=10', __DIR__.'/normalize.php']);
        $process->setInput($input)->setTimeout(15);
        try {
            $process->run(function ($type, $buffer) use ($process): void {
                if ($type === Process::OUT && strlen($process->getOutput()) > 10485760) {
                    $process->stop(0);
                }
            });
        } catch (ProcessTimedOutException) {
            throw new ApiProblem('PHOTO_INVALID', 422, 'This photo could not be safely inspected.');
        }
        $output = $process->getOutput();
        $normalized = @getimagesizefromstring($output);
        if (! $process->isSuccessful() || ! $normalized || $normalized[2] !== $shape[2] ||
            strlen($output) < 1 || strlen($output) > 10485760) {
            throw new ApiProblem('PHOTO_INVALID', 422, 'This photo could not be safely inspected.');
        }

        return ['content' => $output, 'mime' => $shape['mime'], 'bytes' => strlen($output), 'sha256' => hash('sha256', $output)];
    }
}

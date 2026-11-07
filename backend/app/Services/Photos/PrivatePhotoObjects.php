<?php

namespace App\Services\Photos;

use App\Support\ApiProblem;

/** Local immutable objects. Root is private configuration, never caller-controlled. */
final class PrivatePhotoObjects
{
    public function path(string $key): string
    {
        if (! preg_match('~^incident-photos/[a-f0-9]{2}/[a-f0-9]{64}$~D', $key)) {
            throw new ApiProblem('PHOTO_INTEGRITY', 503, 'Private photo integrity check failed.');
        }
        $root = config('filesystems.disks.private_incident_photos.root');
        if (! is_string($root) || ! str_starts_with($root, DIRECTORY_SEPARATOR) && ! preg_match('~^[A-Za-z]:[\\\\/]~', $root)) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Private photo storage is unavailable.');
        }
        $path = rtrim(str_replace('\\', '/', $root), '/');
        $private = rtrim(str_replace('\\', '/', storage_path('app/private')), '/').'/';
        $comparison = PHP_OS_FAMILY === 'Windows' ? strtolower($path).'/' : $path.'/';
        $prefix = PHP_OS_FAMILY === 'Windows' ? strtolower($private) : $private;
        if (! str_starts_with($comparison, $prefix) || in_array('..', explode('/', $path), true)) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Photo storage must remain inside the private application root.');
        }
        $parts = explode('/', $path);
        $probe = '';
        foreach ($parts as $part) {
            $probe .= $part.'/';
            if (is_link(rtrim($probe, '/'))) {
                throw new ApiProblem('PHOTO_INTEGRITY', 503, 'Private photo integrity check failed.');
            }
        }
        foreach (explode('/', $key) as $part) {
            $path .= '/'.$part;
            if (is_link($path)) {
                throw new ApiProblem('PHOTO_INTEGRITY', 503, 'Private photo integrity check failed.');
            }
        }

        return $path;
    }

    public function put(string $key, string $content): void
    {
        $path = $this->path($key);
        if (! is_dir(dirname($path)) && ! mkdir(dirname($path), 0700, true) && ! is_dir(dirname($path))) {
            throw new ApiProblem('PHOTO_STORAGE', 503, 'Private photo storage is unavailable.');
        }
        $path = $this->path($key);
        $stream = @fopen($path, 'x+b');
        if (! $stream) {
            throw new ApiProblem('PHOTO_STORAGE', 503, 'Private photo storage is unavailable.');
        }
        try {
            @chmod($path, 0600);
            $offset = 0;
            while ($offset < strlen($content)) {
                $written = fwrite($stream, substr($content, $offset));
                if (! $written) {
                    throw new ApiProblem('PHOTO_STORAGE', 503, 'Private photo storage is unavailable.');
                }
                $offset += $written;
            }
            fflush($stream);
            if (function_exists('fsync')) {
                fsync($stream);
            }
        } finally {
            fclose($stream);
        }
    }

    public function verified(object $photo): string
    {
        $path = $this->path($photo->object_key);
        clearstatcache(true, $path);
        $hash = is_file($path) ? @hash_file('sha256', $path) : false;
        if ($photo->disk !== 'private_incident_photos' || ! is_string($hash) ||
            filesize($path) !== (int) $photo->bytes || ! hash_equals($photo->sha256, $hash)) {
            throw new ApiProblem('PHOTO_INTEGRITY', 503, 'Private photo integrity check failed.');
        }

        return $path;
    }

    public function remove(string $key): void
    {
        $path = $this->path($key);
        if (file_exists($path) && (! is_file($path) || ! unlink($path))) {
            throw new ApiProblem('PHOTO_STORAGE', 503, 'Private photo cleanup could not finish.');
        }
    }
}

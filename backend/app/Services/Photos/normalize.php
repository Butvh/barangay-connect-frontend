<?php

// Private CLI worker: no Laravel/database, filenames, network or caller-selected options.
if (PHP_SAPI !== 'cli' || ! extension_loaded('gd')) {
    exit(2);
}
set_error_handler(static function (): never {
    throw new RuntimeException('Invalid image.');
});
try {
    $input = stream_get_contents(STDIN, 10485761);
    $shape = getimagesizefromstring($input);
    if (strlen($input) > 10485760 || ! $shape || ! in_array($shape[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true) ||
        min($shape[0], $shape[1]) < 1 || max($shape[0], $shape[1]) > 8192 || $shape[0] * $shape[1] > 16000000) {
        exit(2);
    }
    $image = imagecreatefromstring($input);
    unset($input);
    if (! $image) {
        exit(2);
    }
    if ($shape[2] === IMAGETYPE_PNG) {
        imagesavealpha($image, true);
        imagepng($image, null, 6);
    } else {
        imagejpeg($image, null, 90);
    }
} catch (Throwable) {
    exit(2);
}

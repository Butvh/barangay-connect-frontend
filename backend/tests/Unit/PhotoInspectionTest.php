<?php

namespace Tests\Unit;

use App\Services\Photos\PhotoInspector;
use App\Support\ApiProblem;
use Tests\TestCase;

final class PhotoInspectionTest extends TestCase
{
    public function test_actual_png_is_normalized_without_appended_metadata(): void
    {
        $image = imagecreatetruecolor(2, 2);
        ob_start();
        imagepng($image);
        $bytes = ob_get_clean();
        $result = (new PhotoInspector)->inspect($bytes.'private-location-marker');
        $this->assertSame('image/png', $result['mime']);
        $this->assertStringNotContainsString('private-location-marker', $result['content']);
        $this->assertSame(hash('sha256', $result['content']), $result['sha256']);
        $this->assertSame(strlen($result['content']), $result['bytes']);
    }

    public function test_filename_content_cannot_pass_as_an_image(): void
    {
        $this->expectException(ApiProblem::class);
        (new PhotoInspector)->inspect('flood-photo.png');
    }

    public function test_oversized_input_is_rejected_before_decoding(): void
    {
        $this->expectException(ApiProblem::class);
        (new PhotoInspector)->inspect(str_repeat('x', 10485761));
    }

    public function test_huge_dimensions_are_rejected_before_decoding(): void
    {
        $header = "\x89PNG\r\n\x1a\n".pack('N', 13).'IHDR'.pack('NNCCCCC', 8193, 1, 8, 2, 0, 0, 0);
        $this->expectException(ApiProblem::class);
        (new PhotoInspector)->inspect($header);
    }

    public function test_jpeg_ancillary_exif_segment_is_removed_from_normalized_bytes(): void
    {
        ob_start();
        imagejpeg(imagecreatetruecolor(4, 4));
        $jpeg = ob_get_clean();
        $metadata = "Exif\0\0GPS-private-marker";
        $input = substr($jpeg, 0, 2)."\xff\xe1".pack('n', strlen($metadata) + 2).$metadata.substr($jpeg, 2);
        $result = (new PhotoInspector)->inspect($input);
        $this->assertSame('image/jpeg', $result['mime']);
        $this->assertStringNotContainsString('GPS-private-marker', $result['content']);
    }

    public function test_truncated_image_with_recognizable_header_is_not_a_successful_decode(): void
    {
        ob_start();
        imagepng(imagecreatetruecolor(4, 4));
        $png = ob_get_clean();
        $this->expectException(ApiProblem::class);
        (new PhotoInspector)->inspect(substr($png, 0, 40));
    }
}

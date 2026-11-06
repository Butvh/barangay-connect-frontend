<?php

declare(strict_types=1);

namespace App\Services\P2;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class Problem extends \RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message, public readonly array $fields = [])
    {
        parent::__construct($message);
    }

    public function status(): int
    {
        return match ($this->errorCode) {
            'AUTH' => 401, 'FORBIDDEN' => 403, 'NOT_FOUND' => 404, 'CONFLICT','CAPACITY','INVALID_STATE' => 409, 'VALIDATION' => 422, default => 503
        };
    }

    /** Laravel renders controller exceptions inside its routing pipeline, before outer middleware catches. */
    public function render(Request $request)
    {
        $id = $request->attributes->get('request_id') ?? (string) Str::uuid();

        return response()->json(['code' => $this->errorCode, 'message' => $this->getMessage(), 'fields' => (object) $this->fields, 'request_id' => $id], $this->status())
            ->header('Cache-Control', 'no-store, private')->header('X-Request-ID', $id);
    }
}

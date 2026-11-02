<?php

declare(strict_types=1);

namespace App\Http\Controllers\P2;

use App\Contracts\P2\ReferenceData;
use App\Services\P2\Actor;
use App\Services\P2\Problem;
use App\Services\P2\Rules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class P2Controller
{
    public function __construct(protected ReferenceData $refs) {}

    protected function actor(Request $request): Actor
    {
        $id = $request->user()?->getAuthIdentifier();
        if (! is_int($id) && ! (is_string($id) && ctype_digit($id))) {
            throw new Problem('AUTH', 'Sign in to continue.');
        }

        return $this->refs->actorFor(Rules::id((int) $id));
    }

    protected function id(string $id): int
    {
        if (! ctype_digit($id) || strlen($id) > 15) {
            throw new Problem('NOT_FOUND', 'This record is unavailable.');
        }

        return Rules::id((int) $id);
    }

    protected function body(Request $request): array
    {
        if (! $request->isJson()) {
            throw new Problem('VALIDATION', 'Send a JSON object.');
        }
        $raw = json_decode($request->getContent(), false);
        if (! $raw instanceof \stdClass) {
            throw new Problem('VALIDATION', 'Send a JSON object.');
        }

        return $request->json()->all();
    }

    protected function query(Request $request, array $allowed): array
    {
        $query = $request->query();
        Rules::only($query, $allowed);
        foreach ($query as $key => $value) {
            if (! is_string($value) || mb_strlen($value) > 200) {
                throw new Problem('VALIDATION', 'Check query filters.');
            }
            if (in_array($key, ['resident_id', 'actor_id', 'rating'], true)) {
                if (! ctype_digit($value)) {
                    throw new Problem('VALIDATION', 'Use a whole-number filter.');
                }
                $query[$key] = Rules::id((int) $value, $key);
            }
        }

        return $query;
    }

    protected function key(Request $request): string
    {
        return Rules::key($request->header('Idempotency-Key'));
    }

    protected function data(mixed $data): JsonResponse
    {
        return response()->json(['data' => $data]);
    }

    // Complete scoped lists: the adapters must not confuse a first page with the full scope.
    protected function listing(array $data): JsonResponse
    {
        return response()->json(['data' => $data, 'meta' => ['complete' => true, 'total' => count($data)]]);
    }
}

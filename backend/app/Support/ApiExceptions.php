<?php

namespace App\Support;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class ApiExceptions
{
    public static function render(Throwable $error, Request $request)
    {
        if (! $request->is('api/*')) {
            return null;
        }
        $status = match (true) {
            $error instanceof ApiProblem => $error->status,
            $error instanceof AuthenticationException => 401,
            $error instanceof AuthorizationException => 403,
            $error instanceof TokenMismatchException => 419,
            $error instanceof ValidationException => 422,
            $error instanceof HttpExceptionInterface => $error->getStatusCode(),
            default => 500,
        };
        [$code, $message] = match ($status) {
            401 => ['AUTH', 'Sign in to continue.'],
            403 => ['FORBIDDEN', 'This action is not available for your account.'],
            404 => ['NOT_FOUND', 'This record was not found.'],
            405 => ['NOT_FOUND', 'This action was not found.'],
            409 => ['CONFLICT', 'This record changed. Refresh and try again.'],
            413 => ['VALIDATION', 'The uploaded request exceeds the allowed size.'],
            419 => ['CSRF', 'Your session changed. Refresh and try again.'],
            422 => ['VALIDATION', 'Check the highlighted fields.'],
            429 => ['RATE_LIMIT', 'Too many attempts. Try again later.'],
            503 => ['NOT_AVAILABLE', 'This service is not available yet.'],
            default => ['SERVER', 'The request could not be completed.'],
        };
        $fields = [];
        if ($error instanceof ApiProblem) {
            $code = $error->errorCode;
            $message = $error->getMessage();
            $fields = $error->fields;
        } elseif ($error instanceof ValidationException) {
            // Derive fixed explanations from rule names, never interpolate submitted values.
            $failed = $error->validator->failed();
            foreach (array_keys($error->errors()) as $key) {
                $rules = $failed[$key] ?? [];
                $fields[$key] = isset($rules['Required']) ? 'This field is required.'
                    : (isset($rules['Integer']) ? 'Enter a whole number.' : 'Check this field.');
            }
        }
        $id = $request->attributes->get('request_id') ?? (string) Str::uuid();
        $response = response()->json([
            'code' => $code, 'message' => $message,
            'fields' => (object) $fields, 'request_id' => $id,
        ], $status);
        if ($error instanceof HttpExceptionInterface && isset($error->getHeaders()['Retry-After'])) {
            $response->headers->set('Retry-After', $error->getHeaders()['Retry-After']);
        }
        $response->headers->set('Cache-Control', 'no-store, private');
        $response->headers->set('X-Request-ID', $id);

        return $response;
    }
}

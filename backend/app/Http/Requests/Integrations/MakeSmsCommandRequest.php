<?php

namespace App\Http\Requests\Integrations;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Str;

final class MakeSmsCommandRequest extends FormRequest
{
    public function authorize(): bool
    {
        $token = config('messaging.make.command_token', '');

        return config('messaging.make.enabled') && strlen($token) >= 32
            && hash_equals($token, $this->bearerToken() ?? '')
            && hash_equals(config('messaging.make.credential_id'), $this->header('X-Credential-Id', ''));
    }

    public function rules(): array
    {
        return ['event_id' => ['required', 'uuid'], 'barangay_id' => ['required', 'integer', 'min:1'],
            'type' => ['required', 'in:announcement.published.v1,announcement.published.v2'], 'template_key' => ['required', 'in:announcement-review.v1,announcement-published.v2'],
            'timestamp' => ['required', 'integer']];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if (array_diff(array_keys($this->all()), array_keys($this->rules()))) {
                $validator->errors()->add('command', 'Unexpected command fields.');
            }
            if (! $this->isJson() || strlen($this->getContent()) > 2048) {
                $validator->errors()->add('command', 'A bounded JSON command is required.');
            }
            if (abs(now()->timestamp - (int) $this->input('timestamp')) > config('messaging.make.window_seconds')) {
                $validator->errors()->add('timestamp', 'Command has expired.');
            }
        });
    }

    protected function failedAuthorization(): void
    {
        throw new HttpResponseException(response()->json(['code' => 'AUTH', 'message' => 'Invalid integration credentials.', 'fields' => (object) [], 'request_id' => (string) Str::uuid()], 401));
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json(['code' => 'VALIDATION', 'message' => 'Invalid integration command.', 'fields' => $validator->errors(), 'request_id' => (string) Str::uuid()], 422));
    }
}

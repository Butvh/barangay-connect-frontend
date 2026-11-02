<?php

namespace Database\Factories;

use App\Models\Barangay;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return ['barangay_id' => Barangay::factory(), 'full_name' => 'Fictional Resident '.Str::random(6), 'email' => strtolower(Str::uuid().'@example.invalid'),
            'password' => Hash::make(Str::random(48)), 'is_resident' => true, 'is_captain' => false, 'account_status' => 'Active'];
    }
}

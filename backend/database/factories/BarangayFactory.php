<?php

namespace Database\Factories;

use App\Models\Barangay;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class BarangayFactory extends Factory
{
    protected $model = Barangay::class;

    public function definition(): array
    {
        return ['name' => 'Fictional Barangay '.Str::random(6), 'map_scope' => null];
    }
}

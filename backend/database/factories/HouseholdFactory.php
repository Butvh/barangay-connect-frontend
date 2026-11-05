<?php

namespace Database\Factories;

use App\Models\Barangay;
use App\Models\Household;
use Illuminate\Database\Eloquent\Factories\Factory;

class HouseholdFactory extends Factory
{
    protected $model = Household::class;

    public function definition(): array
    {
        return ['barangay_id' => Barangay::factory(), 'address' => 'Fictional district', 'map_x' => 0, 'map_y' => 0];
    }
}

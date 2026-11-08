<?php

namespace Database\Factories;

use App\Models\Barangay;
use App\Models\Facility;
use Illuminate\Database\Eloquent\Factories\Factory;

class FacilityFactory extends Factory
{
    protected $model = Facility::class;

    public function definition(): array
    {
        return ['managed_by_barangay_id' => Barangay::factory(), 'visibility' => 'local', 'name' => 'Fictional evacuation center',
            'type' => 'Evacuation Center', 'address' => 'Fictional district', 'active' => true];
    }
}

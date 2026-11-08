<?php

namespace App\Support;

final class MapCoverage
{
    public static function supported(?string $scope): bool
    {
        return $scope === 'sampaguita';
    }
}

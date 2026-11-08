<?php

namespace App\Services\Messaging;

final class PhoneNumber
{
    public static function normalize(string $number): string
    {
        if (! preg_match('/^\+?[0-9][0-9 ()-]*$/D', $number)) {
            throw new \InvalidArgumentException('invalid_ph_mobile');
        }
        $digits = preg_replace('/[^0-9]/', '', $number);
        if (preg_match('/^09[0-9]{9}$/D', $digits)) {
            $digits = '63'.substr($digits, 1);
        }
        if (! preg_match('/^639[0-9]{9}$/D', $digits)) {
            throw new \InvalidArgumentException('invalid_ph_mobile');
        }

        return $digits;
    }
}

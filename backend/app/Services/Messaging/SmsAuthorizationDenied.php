<?php

namespace App\Services\Messaging;

/** Bounded private diagnostic; never carries contact/provider/user exception details. */
final class SmsAuthorizationDenied extends \RuntimeException {}

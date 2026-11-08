<?php

namespace App\Services\Messaging;

/** Safe, terminal contract diagnostic; never contains caller/provider payload values. */
final class EventContractViolation extends \InvalidArgumentException {}

<?php

namespace App\Contracts\P2;

use App\Services\P2\Actor;
use Illuminate\Http\Request;

/** Production actor reads retain P1's captured security generation. */
interface ActorReferences
{
    public function current(Request $request): Actor;

    public function locked(Actor $observed): Actor;
}

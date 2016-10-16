<?php

namespace Illuminate\Auth\Middleware;

use Closure;
use Illuminate\Auth\AuthManager;
use Illuminate\Auth\SessionGuard;
use Illuminate\Http\Request;

class AuthenticateOnceWithBasicAuth
{
    private $authManager;

    public function __construct(AuthManager $authManager)
    {
        $this->authManager = $authManager;
    }

    public function handle(Request $request, Closure $next)
    {
        /** @var SessionGuard $guard */
        $guard = $this->authManager->guard();
        $guard->onceBasic() ?: $next($request);
    }

}
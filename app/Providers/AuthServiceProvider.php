<?php

namespace App\Providers;

use Illuminate\Auth\AuthManager;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Tymon\JWTAuth\JWTAuth;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [];

    public function boot()
    {
        $this->registerPolicies();

        /** @var AuthManager $authManager */
        $authManager = $this->app->make('auth');

        /** @var JwtAuth $jwtAuth */
        $jwtAuth = $this->app->make(JWTAuth::class);

        $authManager->viaRequest('jwt', function (Request $request) use ($jwtAuth) {
            $token = $jwtAuth->setRequest($request)->getToken();
            if (!$token) {
                return null;
            }

            return $jwtAuth->authenticate($token);
        });
    }
}

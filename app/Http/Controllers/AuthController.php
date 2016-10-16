<?php

namespace App\Http\Controllers;

use App\User;
use Illuminate\Contracts\Hashing\Hasher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Tymon\JWTAuth\JWTAuth;

class AuthController extends Controller
{
    private $hasher;
    private $jwtAuth;
    private $request;

    public function __construct(Hasher $hasher, JWTAuth $jwtAuth, Request $request)
    {
        $this->hasher = $hasher;
        $this->jwtAuth = $jwtAuth;
        $this->request = $request;
    }

    public function createUser()
    {
        $this->validate($this->request, [
            'name' => 'required|max:255',
            'email' => 'required|email|max:255|unique:users',
            'password' => 'required|min:6'
        ]);

        $data = $this->request->only(['name', 'email', 'password']);
        $data['password'] = $this->hasher->make($data['password']);

        $user = User::create($data);
        $token = $this->jwtAuth->fromUser($user);

        return new JsonResponse([
            'data' => $user,
            'meta' => [
                'token' => $token
            ]
        ]);
    }

    public function createToken()
    {

    }
}

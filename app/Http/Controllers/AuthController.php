<?php

namespace App\Http\Controllers;

use App\User;
use Illuminate\Contracts\Hashing\Hasher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tymon\JWTAuth\JWTAuth;

class AuthController extends Controller
{
    private $hasher;
    private $jwtAuth;
    private $request;
    private $userAsService;

    public function __construct(
        Hasher $hasher,
        JWTAuth $jwtAuth,
        Request $request,
        User $userAsService
    ) {
        $this->hasher = $hasher;
        $this->jwtAuth = $jwtAuth;
        $this->request = $request;
        $this->userAsService = $userAsService;
    }

    public function createUser(): JsonResponse
    {
        $this->validate($this->request, [
            'name' => ['required', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'min:6']
        ]);

        $data = $this->request->only(['name', 'email', 'password']);
        $data['password'] = $this->hasher->make($data['password']);

        $user = $this->userAsService
            ->replicate()
            ->fill($data)
            ->save();
        $token = $this->jwtAuth->fromUser($user);

        return $this->respondWithUser($user, $token);
    }

    public function createToken(): JsonResponse
    {
        $credentials = $this->request->only('email', 'password');

        $token = $this->jwtAuth->attempt($credentials);
        if (!$token) {
            throw new HttpException(401);
        }

        /** @var User $user */
        $user = $this->userAsService
            ->newQuery()
            ->where('email', $credentials['email'])
            ->first();

        return $this->respondWithUser($user, $token);
    }

    private function respondWithUser(User $user, string $token): JsonResponse
    {
        return new JsonResponse([
            'data' => $user,
            'meta' => [
                'token' => $token
            ]
        ]);
    }
}

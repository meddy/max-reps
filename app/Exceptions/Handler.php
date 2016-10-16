<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Debug\Exception\FlattenException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class Handler extends ExceptionHandler
{
    protected $dontReport = [
        AuthenticationException::class,
        AuthorizationException::class,
        HttpException::class,
        ModelNotFoundException::class,
        TokenMismatchException::class,
        ValidationException::class,
    ];

    public function render($request, Exception $error)
    {
        $statusCode = 500;
        $message = 'Server Error';

        if ($error instanceof ValidationException) {
            return $this->renderValidationException($error);
        }

        if ($error instanceof AuthorizationException) {
            $statusCode = 403;
        }

        if ($error instanceof ModelNotFoundException) {
            $error = new HttpException(404);
        }

        if ($this->shouldntReport($error)) {
            $message = $error->getMessage();
        }

        $data = ['message' => $message];
        $error = FlattenException::create($error, $statusCode);

        if (env('APP_DEBUG')) {
            $data = ['message' => $error->getMessage(), 'trace' => $error->getTrace()];
        }

        return new JsonResponse($data, $error->getStatusCode(), $error->getHeaders());
    }

    private function renderValidationException(ValidationException $error)
    {
        /** @var JsonResponse $response */
        $response = $error->getResponse();

        return $response->setData([
            'message' => $error->getMessage(),
            'fields' => $response->getData()
        ]);
    }
}

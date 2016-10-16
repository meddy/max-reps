<?php

namespace App\Providers;

use App\Http\Controllers\Auth\ForgotPasswordController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\ResetPasswordController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ExerciseController;
use App\Http\Controllers\ExerciseTemplateController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\SetController;
use App\Http\Controllers\WorkoutController;
use App\Http\Controllers\WorkoutTemplateController;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Router;

class RouteServiceProvider extends ServiceProvider
{
    public function map()
    {
        /** @var Router $router */
        $router = $this->app->make('router');

        $router->group(['prefix' => 'auth'], function (Router $router) {
            $this->mapAuthRoutes($router);
        });

        $router->group(['middleware' => 'auth'], function (Router $router) {
            $this->mapResourceRoutes($router);
        });
    }

    protected function mapAuthRoutes(Router $router)
    {
        $router->post('/token', AuthController::class . '@createToken');
        $router->post('/user', AuthController::class . '@createUser');
    }

    protected function mapResourceRoutes(Router $router)
    {
        $router->resource('workouts', WorkoutController::class, [
            'only' => ['index', 'store', 'show', 'update', 'destroy']
        ]);

        $router->resource('workout-templates', WorkoutTemplateController::class, [
            'only' => ['index', 'store', 'show', 'update', 'destroy'],
            'parameters' => [
                'workout-templates' => 'workoutTemplate'
            ]
        ]);

        $router->resource('exercises', ExerciseController::class, [
            'only' => ['index', 'store', 'update', 'destroy']
        ]);

        $router->resource('workouts-templates.exercise-templates', ExerciseTemplateController::class, [
            'only' => ['store', 'update', 'destroy'],
            'parameters' => [
                'workout-templates' => 'workoutTemplate',
                'exercise-templates' => 'exerciseTemplate'
            ]
        ]);

        $router->resource('workouts.sets', SetController::class, [
            'only' => ['store', 'update', 'destroy']
        ]);
    }
}

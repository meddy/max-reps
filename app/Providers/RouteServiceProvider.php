<?php

namespace App\Providers;

use App\Http\Controllers\ExerciseController;
use App\Http\Controllers\ExerciseTemplateController;
use App\Http\Controllers\SetController;
use App\Http\Controllers\WorkoutController;
use App\Http\Controllers\WorkoutTemplateController;
use Illuminate\Routing\Router;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\ForgotPasswordController;
use App\Http\Controllers\Auth\ResetPasswordController;

class RouteServiceProvider extends ServiceProvider
{
    public function map()
    {
        $this->mapWebRoutes();
    }

    protected function mapWebRoutes()
    {
        /** @var Router $router */
        $router = $this->app->make('router');
        $router->group(['middleware' => 'web'], function (Router $router) {
            $router->get('/', HomeController::class . '@displayWelcome');
            $router->get('/home', HomeController::class . '@displayHome');

            $router->get('login', LoginController::class . '@showLoginForm')->name('login');
            $router->post('login', LoginController::class . '@login');
            $router->post('logout', LoginController::class . '@logout');

            $router->get('register', RegisterController::class . '@showRegistrationForm');
            $router->post('register', RegisterController::class . '@register');

            $router->get('password/reset', ForgotPasswordController::class . '@showLinkRequestForm');
            $router->post('password/email', ForgotPasswordController::class . '@sendResetLinkEmail');
            $router->get('password/reset/{token}', ResetPasswordController::class . '@showResetForm');
            $router->post('password/reset', ResetPasswordController::class . '@reset');

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
        });
    }
}

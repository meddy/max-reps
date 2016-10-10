<?php

use App\User;
use Faker\Generator;

/** @var \Illuminate\Database\Eloquent\Factory $factory*/

$factory->define(User::class, function (Generator $faker) {
    return [
        'name' => $faker->name,
        'email' => $faker->unique()->safeEmail,
        'password' => bcrypt('insecure'),
        'remember_token' => str_random(10),
    ];
});

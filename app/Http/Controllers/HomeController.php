<?php

namespace App\Http\Controllers;

use \Illuminate\Contracts\View\Factory;

class HomeController extends Controller
{
    private $viewFactory;

    public function __construct(Factory $viewFactory)
    {
        $this->viewFactory = $viewFactory;
        $this->middleware('auth');
    }

    public function displayWelcome()
    {
        return $this->viewFactory->make('welcome');
    }

    public function displayHome()
    {
        return $this->viewFactory->make('home');
    }
}

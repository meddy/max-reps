<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class WorkoutController extends Controller
{
    private $request;

    public function __construct(Request $request)
    {
        $this->request = $request;
    }

    public function index()
    {
        $user = $this->request->user();
        return $user->workoutsPaginated();
    }

    public function store(Request $request)
    {
    }

    public function destroy($id)
    {
    }
}

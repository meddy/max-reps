<?php

use App\Exercise;
use App\ExerciseTemplate;
use App\Set;
use App\User;
use App\Workout;
use App\WorkoutTemplate;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class WorkoutDataSeeder extends Seeder
{
    private $exerciseService;

    public function __construct()
    {
        $this->exerciseService = new Exercise;
    }

    public function run()
    {
        $user = User::create([
            'name' => 'Max Eddy',
            'email' => 'max@maxreps.com',
            'password' => bcrypt('password1234'),
        ]);

        $push = WorkoutTemplate::create(['user_id' => $user->id, 'name' => 'Push']);
        $benchPress = $this->createExerciseTemplate($push, 'Dumbbell Bench Press');
        $shoulderPress = $this->createExerciseTemplate($push, 'Seated Overhead Dumbbell Press');
        $tricepExtension = $this->createExerciseTemplate($push, 'Dumbbell Triceps Extension');

        $pull = WorkoutTemplate::create(['user_id' => $user->id, 'name' => 'Pull']);
        $pullUp = $this->createExerciseTemplate($pull, 'Pull-Up');
        $row = $this->createExerciseTemplate($pull, 'Dumbbell Row');
        $curl = $this->createExerciseTemplate($pull, 'Dumbbell Curl');

        $legs = WorkoutTemplate::create(['user_id' => $user->id, 'name' => 'Legs']);
        $squat = $this->createExerciseTemplate($legs, 'Dumbbell Split Squat');
        $legCurl = $this->createExerciseTemplate($legs, 'Leg Curl');
        $calfRaise = $this->createExerciseTemplate($legs, 'Standing Calf Raise');

        $pushWorkout = Workout::create([
            'workout_template_id' => $push->id,
            'performed' => Carbon::now()->subDays(2)
        ]);
        $this->createSets($benchPress, $pushWorkout, 75);
        $this->createSets($shoulderPress, $pushWorkout, 45);
        $this->createSets($tricepExtension, $pushWorkout, 25);

        $pullWorkout = Workout::create([
            'workout_template_id' => $pull->id,
            'performed' => Carbon::now()->subDays(1)
        ]);
        $this->createSets($pullUp, $pullWorkout, null);
        $this->createSets($row, $pullWorkout, 75);
        $this->createSets($curl, $pushWorkout, 25);

        $legWorkout = Workout::create([
            'workout_template_id' => $legs->id,
            'performed' => Carbon::now()
        ]);
        $this->createSets($squat, $legWorkout, 45);
        $this->createSets($legCurl, $legWorkout, 55);
        $this->createSets($calfRaise, $legWorkout, 25);
    }

    private function createExerciseTemplate(WorkoutTemplate $workoutTemplate, $exerciseName)
    {
        $exercise = $this->exerciseService
            ->newQuery()
            ->where('name', $exerciseName)
            ->first();

        $attributes = [
            'workout_template_id' => $workoutTemplate->id,
            'exercise_id' => $exercise->id,
            'sets_min' => 3,
            'sets_max' => 4,
            'reps_min' => 8,
            'reps_max' => 12,
            'rest_min' => 60,
            'rest_max' => 90
        ];

        return ExerciseTemplate::create($attributes);
    }

    private function createSets(ExerciseTemplate $exercise, Workout $workout, $weight)
    {
        $attributes = [
            'exercise_id' => $exercise->exercise_id,
            'workout_id' => $workout->id
        ];

        $sets = [
            ['weight' => $weight, 'reps' => 12],
            ['weight' => $weight, 'reps' => 10],
            ['weight' => $weight, 'reps' => 8]
        ];

        foreach ($sets as $setAttributes) {
            Set::create(array_merge($attributes, $setAttributes));
        }
    }
}

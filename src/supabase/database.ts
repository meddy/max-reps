import { ExerciseRow, SetRow, Workout } from "../types";
import supabase from "./client";

export async function fetchExercises() {
  const { data, error } = await supabase.from("exercises").select();
  if (error) throw error;

  const exercises = new Map<number, ExerciseRow>();
  data.forEach((exerciseRow) => {
    exercises.set(exerciseRow.id, exerciseRow);
  });

  return exercises;
}

export async function fetchWorkouts(offset = 0) {
  const { data: workouts, error: workoutsError } = await supabase
    .from("workouts")
    .select()
    .order("id")
    .range(offset, 10);

  if (workoutsError) throw workoutsError;

  const { data: sets, error: setsError } = await supabase
    .from("sets")
    .select()
    .in(
      "workout_id",
      workouts.map(({ id }) => id)
    )
    .order("id");

  if (setsError) throw setsError;

  const workoutMap = new Map<number, Workout>();
  for (const workout of workouts) {
    workoutMap.set(workout.id, {
      ...workout,
      exerciseMap: new Map<number, SetRow[]>(),
    });
  }

  for (const set of sets) {
    const workout = workoutMap.get(set.workout_id);
    if (!workout) {
      continue;
    }

    const { exerciseMap } = workout;
    exerciseMap.set(
      set.exercise_id,
      (exerciseMap.get(set.exercise_id) ?? []).concat(set)
    );
  }

  return workoutMap;
}

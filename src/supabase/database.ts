import { ExerciseRow, WorkoutMap, WorkoutRow } from "../types";
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
  const { data, error } = await supabase
    .from("workouts")
    .select()
    .order("id")
    .range(offset, 10);

  if (error) throw error;

  const workouts = new Map<number, WorkoutRow>();
  data.forEach((exerciseRow) => {
    workouts.set(exerciseRow.id, exerciseRow);
  });

  return workouts;
}

export async function fetchSets(workoutMap: WorkoutMap) {
  const { data, error } = await supabase
    .from("sets")
    .select()
    .in("workout_id", Array.from(workoutMap.keys()))
    .order("id");

  if (error) throw error;

  return data;
}

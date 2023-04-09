import { ExerciseMap, SetMap } from "../types";
import supabase from "./client";

export async function sendToken(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function verifyToken(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "magiclink",
  });
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data;
}

export async function fetchExerciseMap() {
  const { data, error } = await supabase.from("exercises").select();
  if (error) throw error;

  const exerciseMap: ExerciseMap = {};
  for (const exercise of data) {
    exerciseMap[exercise.id] = exercise;
  }

  return exerciseMap;
}

export async function fetchWorkouts() {
  const { data, error } = await supabase.from("workouts").select();
  if (error) throw error;

  return data;
}

export async function fetchSetsByWorkouts() {
  const { data, error } = await supabase.from("sets").select();
  if (error) throw error;

  const setMap: SetMap = {};
  for (const set of data) {
    if (!setMap[set.workout_id]) {
      setMap[set.workout_id] = [];
    }

    setMap[set.workout_id].push(set);
  }

  return setMap;
}

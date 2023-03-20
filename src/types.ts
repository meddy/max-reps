import type { Database } from "./supabase/types";

export type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];
export type SetRow = Database["public"]["Tables"]["sets"]["Row"];
export type WorkoutRow = Database["public"]["Tables"]["workouts"]["Row"];

export type ExerciseMap = Map<number, ExerciseRow>;
export type WorkoutMap = Map<number, WorkoutRow>;

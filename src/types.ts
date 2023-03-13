import { Database } from "./supabase/types";

export type Exercise = Database["public"]["Tables"]["exercises"]["Row"];
export type Set = Database["public"]["Tables"]["sets"]["Row"];
export type Workout = Database["public"]["Tables"]["workouts"]["Row"];

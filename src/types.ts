import type { AuthError, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

export type Exercise = Database["public"]["Tables"]["exercises"]["Row"];
export type Set = Database["public"]["Tables"]["sets"]["Row"];
export type Workout = Database["public"]["Tables"]["workouts"]["Row"];

export type HandleResultFunc = <T, V>(
  result: {
    data: T;
    error: AuthError | PostgrestError | null;
  },
  defaultValue: V
) => V | NonNullable<T>;

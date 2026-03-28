import type { Timestamp } from "firebase/firestore";

export interface Exercise {
  id: string;
  nameLower: string;
  displayName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Day {
  id: string;
  nameLower: string;
  displayName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ExerciseSetTemplate {
  id: string;
  dayId: string;
  exerciseId: string;
  numSets: number;
  repsLower: number;
  repsUpper: number;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Workout {
  id: string;
  date: Timestamp;
  dayId: string;
  dayNameSnapshot: string;
  note?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  reps: number;
  weight: number;
  unit: string;
  note: string;
  performedAt: Timestamp;
  order: number;
  createdAt: Timestamp;
}

export type CollectionName =
  | "exercises"
  | "days"
  | "exerciseSetTemplates"
  | "workouts"
  | "sets";

/** Template row with resolved exercise display name (read model). */
export interface TemplateWithExerciseName extends ExerciseSetTemplate {
  exerciseDisplayName: string;
}

/** Workout list row with aggregated set stats. */
export type WorkoutListItem = Workout & {
  id: string;
  setCount: number;
  exerciseCount: number;
  totalLoad: number;
};

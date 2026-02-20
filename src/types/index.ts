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

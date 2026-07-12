export interface Exercise {
  id: string;
  nameLower: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Day {
  id: string;
  nameLower: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExerciseSetTemplate {
  id: string;
  dayId: string;
  exerciseId: string;
  numSets: number;
  repsLower: number;
  repsUpper: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workout {
  id: string;
  date: Date;
  dayId: string;
  dayNameSnapshot: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
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
  performedAt: Date;
  order: number;
  createdAt: Date;
}

export type CollectionName =
  "exercises" | "days" | "exerciseSetTemplates" | "workouts" | "sets";

/** Template row with resolved exercise display name (read model). */
export interface TemplateWithExerciseName extends ExerciseSetTemplate {
  exerciseDisplayName: string;
}

/** Point for exercise top-set-per-workout chart (read model). */
export interface TopSetChartPoint {
  dateMs: number;
  dateLabel: string;
  weight: number;
  reps: number;
  label: string;
}

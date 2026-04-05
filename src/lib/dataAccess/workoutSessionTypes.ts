import type { EditorExerciseGroup } from "../workoutEditor/model";
import type { Workout } from "../../types";

export type WorkoutDetailEditorSeed = {
  resetKey: string;
  groups: EditorExerciseGroup[];
  variant: "workout" | "template";
};

export type WorkoutDetailSessionCallbacks = {
  onTemplateLoadingChange?: (loading: boolean) => void;
};

export interface WorkoutSessionApi {
  loadWorkoutDetail(
    workoutId: string,
    callbacks?: WorkoutDetailSessionCallbacks
  ): Promise<{
    workout: (Workout & { id: string }) | null;
    editorSeed: WorkoutDetailEditorSeed | null;
    isTemplateMode: boolean;
  }>;

  setWorkoutDate(workoutId: string, date: Date): Promise<void>;

  editorPersistence(workout: { id: string; date: Date }): {
    saveSet(input: {
      workoutId: string;
      exerciseId: string;
      exerciseNameSnapshot: string;
      row: { reps: number; weight: number; note: string };
      order: number;
      performedAt: Date;
    }): Promise<string>;
    updateSet(
      id: string,
      patch: { reps?: number; weight?: number; note?: string }
    ): Promise<void>;
    deleteSet(id: string): Promise<void>;
  };
}

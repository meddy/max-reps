import type { EditorExerciseGroup } from "../workoutEditor/model";
import type { Workout } from "../../types";
import type { TemplateWithExerciseName } from "../../types";

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

  updateWorkout(
    workoutId: string,
    patch: Partial<Pick<Workout, "date" | "note">>
  ): Promise<void>;

  editorPersistence(getPerformedAt: () => Date): {
    saveSet(input: {
      workoutId: string;
      exerciseId: string;
      exerciseNameSnapshot: string;
      row: { reps: number; weight: number; note: string };
      order: number;
    }): Promise<string>;
    updateSet(
      id: string,
      patch: { reps?: number; weight?: number; note?: string }
    ): Promise<void>;
    deleteSet(id: string): Promise<void>;
    reorderSets(updates: Array<{ id: string; order: number }>): Promise<void>;
  };

  lastPerformedGroupForExercise(
    exerciseId: string,
    excludeWorkoutId?: string
  ): Promise<{
    sets: Array<{ reps: number; weight: number; note?: string }>;
    workoutId?: string;
  }>;

  loadFillTemplateData(workoutId: string): Promise<{
    dayTemplates: TemplateWithExerciseName[];
    sameDayPreviousByExercise: Record<
      string,
      {
        sets: Array<{ reps: number; weight: number; note?: string }>;
        workoutId: string;
      }
    >;
  }>;

  deleteWorkoutWithSets(workoutId: string): Promise<void>;
}

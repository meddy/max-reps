import type { DataAccess } from "./dataAccess";
import type { WorkoutSet } from "../types";

export type EditorRowId = string;

export interface EditorSetRow {
  id: EditorRowId;
  persistedSetId?: string;
  reps: number;
  weight: number;
  note: string;
}

export type PersistableSetFields = Pick<
  EditorSetRow,
  "reps" | "weight" | "note"
>;

export interface WorkoutEditorPersistence {
  saveSet(input: {
    workoutId: string;
    exerciseId: string;
    exerciseNameSnapshot: string;
    row: PersistableSetFields;
    order: number;
    performedAt: Date;
  }): Promise<string>;
  updateSet(
    id: string,
    patch: { reps?: number; weight?: number; note?: string }
  ): Promise<void>;
  deleteSet(id: string): Promise<void>;
}

export function createWorkoutEditorPersistence(
  access: DataAccess
): WorkoutEditorPersistence {
  return {
    saveSet(input) {
      return access.sets.create({
        workoutId: input.workoutId,
        exerciseId: input.exerciseId,
        exerciseNameSnapshot: input.exerciseNameSnapshot,
        reps: input.row.reps,
        weight: input.row.weight,
        unit: "lbs",
        note: input.row.note,
        performedAt: input.performedAt,
        order: input.order,
      } as Omit<WorkoutSet, "id" | "createdAt">);
    },
    updateSet(id, patch) {
      return access.sets.update(id, patch);
    },
    deleteSet(id) {
      return access.sets.delete(id);
    },
  };
}

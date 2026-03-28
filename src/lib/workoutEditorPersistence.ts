import type { Timestamp } from "firebase/firestore";
import { dataAccess } from "./dataAccess";
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
    performedAt: Timestamp;
  }): Promise<string>;
  updateSet(
    id: string,
    patch: { reps?: number; weight?: number; note?: string }
  ): Promise<void>;
  deleteSet(id: string): Promise<void>;
}

export function createDefaultWorkoutEditorPersistence(): WorkoutEditorPersistence {
  return {
    saveSet(input) {
      return dataAccess.sets.create({
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
      return dataAccess.sets.update(id, patch);
    },
    deleteSet(id) {
      return dataAccess.sets.delete(id);
    },
  };
}

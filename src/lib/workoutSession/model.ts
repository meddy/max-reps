import type { Workout } from "../../types";
import type {
  EditorRowId,
  EditorSetRow,
  PersistableSetFields,
  WorkoutEditorPersistence,
} from "../workoutEditorPersistence";

export type { EditorRowId, EditorSetRow, WorkoutEditorPersistence };

export interface EditorExerciseGroup {
  groupKey: string;
  exerciseId: string;
  exerciseName: string;
  /** Present for day-template groups (link to day detail). */
  dayId?: string;
  rows: EditorSetRow[];
  templateMeta?: {
    repsLower: number;
    repsUpper: number;
    isAdHoc?: boolean;
  };
  lastPerformed?: {
    sets: Array<{ reps: number; weight: number; note?: string }>;
    workoutId: string;
  };
}

export const DEFAULT_DEBOUNCE_MS = 800;

export interface UseWorkoutEditorOptions {
  variant: "workout" | "template";
  workoutId: string;
  /** Null only before the workout document is loaded; persistence no-ops until set. */
  workout: Workout | null;
  initialGroups: EditorExerciseGroup[];
  resetKey: string;
  persistence: WorkoutEditorPersistence;
  debounceMs?: number;
}

export interface UseWorkoutEditorResult {
  variant: "workout" | "template";
  groups: EditorExerciseGroup[];
  getRowApi(rowId: EditorRowId): {
    row: EditorSetRow;
    setField(field: "reps" | "weight" | "note", value: number | string): void;
    flush(): Promise<void>;
  };
  addExercise(exerciseId: string, name: string): void;
  /** Template mode: append a synthetic template group (e.g. ad-hoc exercise). */
  appendTemplateGroup(group: EditorExerciseGroup): void;
  removeExercise(groupKey: string): Promise<void>;
  addSet(groupKey: string): void;
  /** Deletes Firestore doc when `persistedSetId` is set; always removes the row locally. */
  removeSet(rowId: EditorRowId): Promise<void>;
  flushAll(): Promise<void>;
  isDirty: boolean;
  updateLastPerformed(
    exerciseId: string,
    value: NonNullable<EditorExerciseGroup["lastPerformed"]>
  ): void;
}

export type WorkoutSessionSnapshot = {
  groups: EditorExerciseGroup[];
  isDirty: boolean;
  variant: "workout" | "template";
};

export function cloneGroups(
  groups: EditorExerciseGroup[]
): EditorExerciseGroup[] {
  return groups.map((g) => ({
    ...g,
    rows: g.rows.map((r) => ({ ...r })),
    lastPerformed: g.lastPerformed
      ? {
          workoutId: g.lastPerformed.workoutId,
          sets: g.lastPerformed.sets.map((s) => ({ ...s })),
        }
      : undefined,
  }));
}

export function findRowLocation(
  groups: EditorExerciseGroup[],
  rowId: EditorRowId
): { groupIndex: number; rowIndex: number } | null {
  for (let g = 0; g < groups.length; g++) {
    const r = groups[g].rows.findIndex((row) => row.id === rowId);
    if (r !== -1) return { groupIndex: g, rowIndex: r };
  }
  return null;
}

export function workoutNextOrderSeed(groups: EditorExerciseGroup[]): number {
  return groups.reduce((acc, g) => acc + g.rows.length, 0);
}

export function persistableFields(row: EditorSetRow): PersistableSetFields {
  return {
    reps: row.reps,
    weight: row.weight,
    note: row.note,
  };
}

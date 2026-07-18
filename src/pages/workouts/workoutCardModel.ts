import type { Workout, WorkoutSet } from "../../types";
import { formatSetEntry, tokensFromSets } from "../../lib/setEntry";
import type { SetEntryToken } from "../../lib/setEntry";

export type WorkoutExerciseLine = {
  exerciseId: string;
  exerciseNameSnapshot: string;
  sets: WorkoutSet[];
  entryText: string;
  tokens: SetEntryToken[];
};

export type WorkoutCardModel = {
  workout: Workout & { id: string };
  exercises: WorkoutExerciseLine[];
};

/** Group ordered Sets into exercise lines for card rendering. */
export function groupSetsIntoExerciseLines(
  sets: ReadonlyArray<WorkoutSet>
): WorkoutExerciseLine[] {
  const sorted = [...sets].sort((a, b) => a.order - b.order);
  const lines: WorkoutExerciseLine[] = [];
  for (const set of sorted) {
    const last = lines[lines.length - 1];
    if (last && last.exerciseId === set.exerciseId) {
      last.sets.push(set);
      continue;
    }
    lines.push({
      exerciseId: set.exerciseId,
      exerciseNameSnapshot: set.exerciseNameSnapshot,
      sets: [set],
      entryText: "",
      tokens: [],
    });
  }
  for (const line of lines) {
    const parsed = line.sets.map((s) => ({
      reps: s.reps,
      weight: s.weight,
      note: s.note ?? "",
    }));
    line.entryText = formatSetEntry(parsed);
    line.tokens = tokensFromSets(parsed);
  }
  return lines;
}

export function buildWorkoutCardModel(
  workout: Workout & { id: string },
  sets: ReadonlyArray<WorkoutSet>
): WorkoutCardModel {
  return {
    workout,
    exercises: groupSetsIntoExerciseLines(sets),
  };
}

/** Display label for a Workout name; empty snapshots use a muted placeholder. */
export function workoutDisplayName(dayNameSnapshot: string): {
  text: string;
  isPlaceholder: boolean;
} {
  const trimmed = dayNameSnapshot.trim();
  if (trimmed.length === 0) {
    return { text: "Untitled workout", isPlaceholder: true };
  }
  return { text: trimmed, isPlaceholder: false };
}

export function compareWorkoutsForSort(
  a: Workout & { id: string },
  b: Workout & { id: string },
  sort: "asc" | "desc"
): number {
  const ta = a.date.getTime();
  const tb = b.date.getTime();
  const dateCmp = sort === "asc" ? ta - tb : tb - ta;
  if (dateCmp !== 0) return dateCmp;
  return sort === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
}

export function toDateInputValue(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromInputValue(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

import type { WorkoutSet } from "../../types";
import type { EditorExerciseGroup, EditorSetRow } from "./model";

export type TemplateWithName = import("../../types").ExerciseSetTemplate & {
  id: string;
  exerciseName: string;
  exerciseDisplayName?: string;
  isAdHoc?: boolean;
};

/** Build editor groups from persisted workout sets (workout mode). */
export function editorGroupsFromWorkoutSets(
  sets: Array<WorkoutSet & { id: string }>
): EditorExerciseGroup[] {
  const groups: EditorExerciseGroup[] = [];
  const seen = new Set<string>();
  const byExercise: Record<string, EditorSetRow[]> = {};

  for (const s of sets) {
    if (!seen.has(s.exerciseId)) {
      seen.add(s.exerciseId);
      groups.push({
        groupKey: s.exerciseId,
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseNameSnapshot,
        rows: [],
      });
    }
    if (!byExercise[s.exerciseId]) byExercise[s.exerciseId] = [];
    byExercise[s.exerciseId].push({
      id: s.id,
      persistedSetId: s.id,
      reps: s.reps,
      weight: s.weight,
      note: s.note ?? "",
    });
  }
  for (const g of groups) {
    g.rows = byExercise[g.exerciseId] ?? [];
  }
  return groups;
}

/** Build editor groups for template mode from day templates + last-performed map. */
export function editorGroupsFromDayTemplates(
  templates: TemplateWithName[],
  lastPerformed: Record<
    string,
    {
      sets: Array<{ reps: number; weight: number; note?: string }>;
      workoutId: string;
    }
  >
): EditorExerciseGroup[] {
  return templates.map((t) => ({
    groupKey: t.id,
    exerciseId: t.exerciseId,
    exerciseName: t.exerciseName,
    dayId: t.dayId,
    rows: Array.from({ length: t.numSets }, () => ({
      id: crypto.randomUUID(),
      reps: 0,
      weight: 0,
      note: "",
    })),
    templateMeta: t.isAdHoc
      ? { repsLower: 0, repsUpper: 0, isAdHoc: true }
      : { repsLower: t.repsLower, repsUpper: t.repsUpper, isAdHoc: false },
    lastPerformed: lastPerformed[t.exerciseId],
  }));
}

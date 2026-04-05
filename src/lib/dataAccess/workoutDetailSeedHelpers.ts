import type { TemplateWithExerciseName } from "../../types";
import type { TemplateWithName } from "../workoutEditor/editorSeedBuilders";

type LastPerformedGroupResult = {
  sets: Array<{ reps: number; weight: number; note?: string }>;
  workoutId?: string;
};

/** Collapse per-exercise last-performed query results into a lookup for template seeding. */
export function rollupLastPerformedMap(
  lastResults: ReadonlyArray<
    readonly [exerciseId: string, result: LastPerformedGroupResult]
  >
): Record<
  string,
  {
    sets: Array<{ reps: number; weight: number; note?: string }>;
    workoutId: string;
  }
> {
  const last: Record<
    string,
    {
      sets: Array<{ reps: number; weight: number; note?: string }>;
      workoutId: string;
    }
  > = {};
  for (const [eid, result] of lastResults) {
    if (result.sets.length > 0 && result.workoutId) {
      last[eid] = { sets: result.sets, workoutId: result.workoutId };
    }
  }
  return last;
}

/** Map API templates to editor seed input (exercise display name as `exerciseName`). */
export function toTemplateWithNameRows(
  resolved: TemplateWithExerciseName[]
): TemplateWithName[] {
  return resolved.map((t) => ({
    ...t,
    exerciseName: t.exerciseDisplayName,
  }));
}

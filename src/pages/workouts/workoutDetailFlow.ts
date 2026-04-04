import type { DataAccess } from "../../lib/dataAccess/types";
import {
  editorGroupsFromDayTemplates,
  editorGroupsFromWorkoutSets,
} from "../../lib/workoutEditor/useWorkoutEditor";
import type { EditorExerciseGroup } from "../../lib/workoutEditor/model";
import type { Workout } from "../../types";
import {
  rollupLastPerformedMap,
  toTemplateWithNameRows,
} from "./workoutDetailSeed";

export type WorkoutDetailEditorSeed = {
  resetKey: string;
  groups: EditorExerciseGroup[];
  variant: "workout" | "template";
};

export type WorkoutDetailFlowCallbacks = {
  onTemplateLoadingChange?: (loading: boolean) => void;
};

export async function fetchWorkoutDetailWorkout(
  workoutId: string | undefined,
  dataAccess: DataAccess
): Promise<(Workout & { id: string }) | null> {
  if (!workoutId) return null;
  return dataAccess.workouts.get(workoutId);
}

export async function resolveWorkoutDetailEditorSeed(
  workoutId: string,
  workout: (Workout & { id: string }) | null | undefined,
  dataAccess: DataAccess,
  callbacks?: WorkoutDetailFlowCallbacks
): Promise<{
  editorSeed: WorkoutDetailEditorSeed;
  isTemplateMode: boolean;
}> {
  const list = await dataAccess.sets.listForWorkout(workoutId);

  if (list.length > 0) {
    return {
      editorSeed: {
        resetKey: `${workoutId}-workout`,
        variant: "workout",
        groups: editorGroupsFromWorkoutSets(list),
      },
      isTemplateMode: false,
    };
  }

  if (workout?.dayId) {
    callbacks?.onTemplateLoadingChange?.(true);
    try {
      const resolved = await dataAccess.templates.listForDayWithExerciseNames(
        workout.dayId
      );
      const withNames = toTemplateWithNameRows(resolved);

      const lastResults = await Promise.all(
        withNames.map(async (t) => {
          const result = await dataAccess.sets.lastPerformedGroupForExercise(
            t.exerciseId,
            workoutId
          );
          return [t.exerciseId, result] as const;
        })
      );
      const last = rollupLastPerformedMap(lastResults);

      return {
        editorSeed: {
          resetKey: `${workoutId}-template`,
          variant: "template",
          groups: editorGroupsFromDayTemplates(withNames, last),
        },
        isTemplateMode: true,
      };
    } finally {
      callbacks?.onTemplateLoadingChange?.(false);
    }
  }

  return {
    editorSeed: {
      resetKey: `${workoutId}-workout-empty`,
      variant: "workout",
      groups: [],
    },
    isTemplateMode: false,
  };
}

export async function syncWorkoutDateAndSetsPerformedAt(
  dataAccess: DataAccess,
  params: { workoutId: string; date: Date }
): Promise<void> {
  await dataAccess.workouts.update(params.workoutId, { date: params.date });
  const workoutSets = await dataAccess.sets.listForWorkout(params.workoutId);
  await Promise.all(
    workoutSets.map((s) =>
      dataAccess.sets.update(s.id, { performedAt: params.date })
    )
  );
}

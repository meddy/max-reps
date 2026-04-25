import {
  editorGroupsFromDayTemplates,
  editorGroupsFromWorkoutSets,
} from "../workoutEditor/editorSeedBuilders";
import { createWorkoutEditorPersistence } from "../workoutEditor/persistence";
import type {
  SetsDataSlice,
  TemplatesDataSlice,
  WorkoutsDataSlice,
} from "./dataAccessSlices";
import {
  rollupLastPerformedMap,
  toTemplateWithNameRows,
} from "./workoutDetailSeedHelpers";
import type { WorkoutSessionApi } from "./workoutSessionTypes";

export type {
  WorkoutDetailEditorSeed,
  WorkoutDetailSessionCallbacks,
} from "./workoutSessionTypes";

export type WorkoutSessionApiDeps = {
  workouts: Pick<
    WorkoutsDataSlice,
    "get" | "update" | "deleteWithSets" | "previousForDayBefore"
  >;
  /** Load path uses list/last-performed; editor persistence uses create/update/delete. */
  sets: SetsDataSlice;
  templates: Pick<TemplatesDataSlice, "catalog">;
};

export function createWorkoutSessionApi(
  deps: WorkoutSessionApiDeps
): WorkoutSessionApi {
  return {
    async loadWorkoutDetail(workoutId, callbacks) {
      if (!workoutId) {
        return { workout: null, editorSeed: null, isTemplateMode: false };
      }

      const w = await deps.workouts.get(workoutId);
      if (!w) {
        return { workout: null, editorSeed: null, isTemplateMode: false };
      }

      const list = await deps.sets.listForWorkout(workoutId);

      if (list.length > 0) {
        return {
          workout: w,
          editorSeed: {
            resetKey: `${workoutId}-workout`,
            variant: "workout",
            groups: editorGroupsFromWorkoutSets(list),
          },
          isTemplateMode: false,
        };
      }

      if (!w.dayId) {
        return {
          workout: w,
          editorSeed: {
            resetKey: `${workoutId}-workout-empty`,
            variant: "workout",
            groups: [],
          },
          isTemplateMode: false,
        };
      }

      callbacks?.onTemplateLoadingChange?.(true);
      try {
        const resolved = await deps.templates.catalog.forDay(w.dayId);
        const withNames = toTemplateWithNameRows(resolved);
        const exerciseIds = [...new Set(withNames.map((t) => t.exerciseId))];
        const lastResults = await Promise.all(
          exerciseIds.map(async (exerciseId) => {
            const result = await deps.sets.lastPerformedGroupForExercise(
              exerciseId,
              workoutId
            );
            return [exerciseId, result] as const;
          })
        );
        const last = rollupLastPerformedMap(lastResults);

        return {
          workout: w,
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
    },

    async updateWorkout(workoutId, patch) {
      return deps.workouts.update(workoutId, patch);
    },

    editorPersistence(getPerformedAt) {
      return createWorkoutEditorPersistence({
        sets: deps.sets,
        getPerformedAt,
      });
    },

    lastPerformedGroupForExercise(exerciseId, excludeWorkoutId) {
      return deps.sets.lastPerformedGroupForExercise(
        exerciseId,
        excludeWorkoutId
      );
    },

    async loadFillTemplateData(workoutId) {
      const workout = await deps.workouts.get(workoutId);
      if (!workout || !workout.dayId) {
        return { dayTemplates: [], sameDayPreviousByExercise: {} };
      }

      const dayTemplates = await deps.templates.catalog.forDay(workout.dayId);
      if (dayTemplates.length === 0) {
        return { dayTemplates: [], sameDayPreviousByExercise: {} };
      }

      const previousWorkout = await deps.workouts.previousForDayBefore(
        workout.dayId,
        workout.date
      );
      if (!previousWorkout) {
        return { dayTemplates, sameDayPreviousByExercise: {} };
      }

      const previousSets = await deps.sets.listForWorkout(previousWorkout.id);
      const grouped = new Map<
        string,
        Array<{ reps: number; weight: number; note?: string }>
      >();

      for (const set of previousSets) {
        const bucket = grouped.get(set.exerciseId) ?? [];
        bucket.push({ reps: set.reps, weight: set.weight, note: set.note });
        grouped.set(set.exerciseId, bucket);
      }

      const sameDayPreviousByExercise: Record<
        string,
        {
          sets: Array<{ reps: number; weight: number; note?: string }>;
          workoutId: string;
        }
      > = {};
      for (const [exerciseId, sets] of grouped.entries()) {
        sameDayPreviousByExercise[exerciseId] = {
          sets,
          workoutId: previousWorkout.id,
        };
      }

      return { dayTemplates, sameDayPreviousByExercise };
    },

    deleteWorkoutWithSets(workoutId) {
      return deps.workouts.deleteWithSets(workoutId);
    },
  };
}

import {
  editorGroupsFromDayTemplates,
  editorGroupsFromWorkoutSets,
} from "../workoutEditor/editorSeedBuilders";
import { createWorkoutEditorPersistence } from "../workoutEditor/persistence";
import type { FirestoreDataPort } from "../firestoreDataPort/types";
import type { DataAccess, DataAccessDeps } from "./types";
import { withSaving } from "./withSaving";
import {
  rollupLastPerformedMap,
  toTemplateWithNameRows,
} from "./workoutDetailSeedHelpers";
import type { WorkoutSessionApi } from "./workoutSessionTypes";

export type {
  WorkoutDetailEditorSeed,
  WorkoutDetailSessionCallbacks,
} from "./workoutSessionTypes";

export type WorkoutSessionApiDeps = Pick<
  DataAccess,
  "workouts" | "sets" | "templates"
> & {
  firestore: FirestoreDataPort;
  saving: DataAccessDeps["saving"];
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

    async setWorkoutDate(workoutId, date) {
      return withSaving(deps.saving, () =>
        deps.firestore.syncWorkoutDateAndSetsPerformedAt(workoutId, date)
      );
    },

    editorPersistence(_workout) {
      return createWorkoutEditorPersistence({ sets: deps.sets });
    },
  };
}

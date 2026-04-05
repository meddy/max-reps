import type { Workout } from "../../types";
import type {
  WorkoutDetailSessionCallbacks,
  WorkoutSessionApi,
} from "../dataAccess/workoutSessionTypes";

/**
 * Workout detail route: bundles `WorkoutSessionApi` so the page and hook do not
 * reach through `DataAccess` for session-shaped operations.
 */
export function createWorkoutDetailDataHandlers(
  session: WorkoutSessionApi,
  getWorkout: () => (Workout & { id: string }) | null
) {
  return {
    loadWorkoutDetail(
      workoutId: string,
      callbacks?: WorkoutDetailSessionCallbacks
    ) {
      return session.loadWorkoutDetail(workoutId, callbacks);
    },

    updateWorkout(
      workoutId: string,
      patch: Partial<Pick<Workout, "date" | "note">>
    ) {
      return session.updateWorkout(workoutId, patch);
    },

    createEditorPersistence() {
      return session.editorPersistence(() => {
        const w = getWorkout();
        if (!w) {
          throw new Error("Workout must be loaded before persisting sets");
        }
        return w.date;
      });
    },

    lastPerformedGroupForExercise(
      exerciseId: string,
      excludeWorkoutId?: string
    ) {
      return session.lastPerformedGroupForExercise(
        exerciseId,
        excludeWorkoutId
      );
    },

    deleteWorkoutWithSets(workoutId: string) {
      return session.deleteWorkoutWithSets(workoutId);
    },
  };
}

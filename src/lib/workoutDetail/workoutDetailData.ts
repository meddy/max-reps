import type { Workout } from "../../types";
import type {
  WorkoutDetailCallbacks,
  WorkoutDetailApi,
} from "../dataAccess/workoutDetailTypes";

/**
 * Workout detail route: bundles `WorkoutDetailApi` so the page and hook do not
 * reach through `DataAccess` for workout-detail operations.
 */
export function createWorkoutDetailDataHandlers(
  workoutDetail: WorkoutDetailApi,
  getWorkout: () => (Workout & { id: string }) | null
) {
  return {
    loadWorkoutDetail(workoutId: string, callbacks?: WorkoutDetailCallbacks) {
      return workoutDetail.loadWorkoutDetail(workoutId, callbacks);
    },

    updateWorkout(
      workoutId: string,
      patch: Partial<Pick<Workout, "date" | "note">>
    ) {
      return workoutDetail.updateWorkout(workoutId, patch);
    },

    createEditorPersistence() {
      return workoutDetail.editorPersistence(() => {
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
      return workoutDetail.lastPerformedGroupForExercise(
        exerciseId,
        excludeWorkoutId
      );
    },

    loadFillTemplateData(workoutId: string) {
      return workoutDetail.loadFillTemplateData(workoutId);
    },

    deleteWorkoutWithSets(workoutId: string) {
      return workoutDetail.deleteWorkoutWithSets(workoutId);
    },
  };
}

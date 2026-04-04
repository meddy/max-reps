import { buildExportForBackup } from "../exportForBackup";
import { buildSetsSlice } from "../setsSlice";
import { buildWorkoutsSlice } from "../workoutsSlice";
import type { DataAccessDeps, WorkoutDataPort } from "../types";

export function buildWorkoutDataPort(deps: DataAccessDeps): WorkoutDataPort {
  const { firestore, saving } = deps;
  return {
    workouts: buildWorkoutsSlice(firestore, saving),
    sets: buildSetsSlice(firestore, saving),
    exportForBackup: buildExportForBackup(firestore),
  };
}

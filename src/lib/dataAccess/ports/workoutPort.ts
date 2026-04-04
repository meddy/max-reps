import { buildExportForBackup } from "../exportForBackup";
import { buildSetsSlice } from "../setsSlice";
import { buildWorkoutsSlice } from "../workoutsSlice";
import type { DataAccessDeps, WorkoutDataPort } from "../types";

export function buildWorkoutDataPort(deps: DataAccessDeps): WorkoutDataPort {
  const { db, saving } = deps;
  return {
    workouts: buildWorkoutsSlice(db, saving),
    sets: buildSetsSlice(db, saving),
    exportForBackup: buildExportForBackup(db),
  };
}

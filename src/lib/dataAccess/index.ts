import { db } from "../firebase";
import { endSaving, startSaving } from "../savingStore";
import { resolveExerciseNamesImpl } from "./templateQueries";
import { buildDaysSlice } from "./daysSlice";
import { buildExercisesSlice } from "./exercisesSlice";
import { buildExportForBackup } from "./exportForBackup";
import { buildSetsSlice } from "./setsSlice";
import { buildTemplatesSlice } from "./templatesSlice";
import type { DataAccess, DataAccessDeps } from "./types";
import { buildWorkoutsSlice } from "./workoutsSlice";

export type { DataAccess, DataAccessDeps } from "./types";

export function createDataAccess(deps: DataAccessDeps): DataAccess {
  const { db: firestore, saving } = deps;
  return {
    exercises: buildExercisesSlice(firestore, saving),
    days: buildDaysSlice(firestore, saving),
    templates: buildTemplatesSlice(firestore, saving),
    workouts: buildWorkoutsSlice(firestore, saving),
    sets: buildSetsSlice(firestore, saving),
    resolveExerciseNames(ids: string[]) {
      return resolveExerciseNamesImpl(firestore, ids);
    },
    exportForBackup: buildExportForBackup(firestore),
  };
}

export const dataAccess: DataAccess = createDataAccess({
  db,
  saving: { start: startSaving, end: endSaving },
});

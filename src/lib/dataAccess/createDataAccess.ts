import { buildDaysSlice } from "./daysSlice";
import { buildExercisesSlice } from "./exercisesSlice";
import { buildExportForBackup } from "./exportForBackup";
import { buildSetsSlice } from "./setsSlice";
import { buildTemplatesSlice } from "./templatesSlice";
import {
  resolveDayExistenceImpl,
  resolveExerciseNamesImpl,
} from "./templateQueries";
import { buildWorkoutsSlice } from "./workoutsSlice";
import type { DataAccess, DataAccessDeps } from "./types";
import { createWorkoutDetailApi } from "./workoutDetailApi";

export function createDataAccess(deps: DataAccessDeps): DataAccess {
  const { firestore, saving } = deps;
  const exercises = buildExercisesSlice(firestore, saving);
  const days = buildDaysSlice(firestore, saving);
  const templates = buildTemplatesSlice(firestore, saving);
  const resolveExerciseNames = (ids: string[]) =>
    resolveExerciseNamesImpl(firestore, ids);
  const resolveDayExistence = (ids: string[]) =>
    resolveDayExistenceImpl(firestore, ids);
  const workouts = buildWorkoutsSlice(firestore, saving);
  const sets = buildSetsSlice(firestore, saving);
  const exportForBackup = buildExportForBackup(firestore);

  const workoutDetail = createWorkoutDetailApi({
    workouts,
    sets,
    templates,
  });

  return {
    catalog: { exercises, days },
    exercises,
    days,
    templates,
    resolveExerciseNames,
    resolveDayExistence,
    workouts,
    sets,
    exportForBackup,
    workoutDetail,
  };
}

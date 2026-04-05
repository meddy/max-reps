import { db } from "../firebase";
import { createFirebaseFirestoreDataPort } from "../firestoreDataPort/firebaseAdapter";
import { endSaving, startSaving } from "../savingStore";
import { buildDaysSlice } from "./daysSlice";
import { buildExercisesSlice } from "./exercisesSlice";
import { buildExportForBackup } from "./exportForBackup";
import { buildSetsSlice } from "./setsSlice";
import { buildTemplatesSlice } from "./templatesSlice";
import { resolveExerciseNamesImpl } from "./templateQueries";
import { buildWorkoutsSlice } from "./workoutsSlice";
import type { DataAccess, DataAccessDeps } from "./types";
import { createWorkoutSessionApi } from "./workoutSessionApi";

export type {
  CatalogDataPort,
  DataAccess,
  DataAccessDeps,
  TemplateCatalog,
  TemplateDataPort,
  WorkoutDataPort,
} from "./types";

export type {
  WorkoutDetailEditorSeed,
  WorkoutDetailSessionCallbacks,
} from "./workoutSessionTypes";

export function createDataAccess(deps: DataAccessDeps): DataAccess {
  const { firestore, saving } = deps;
  const exercises = buildExercisesSlice(firestore, saving);
  const days = buildDaysSlice(firestore, saving);
  const templates = buildTemplatesSlice(firestore, saving);
  const resolveExerciseNames = (ids: string[]) =>
    resolveExerciseNamesImpl(firestore, ids);
  const workouts = buildWorkoutsSlice(firestore, saving);
  const sets = buildSetsSlice(firestore, saving);
  const exportForBackup = buildExportForBackup(firestore);

  const workoutSession = createWorkoutSessionApi({
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
    workouts,
    sets,
    exportForBackup,
    workoutSession,
  };
}

export const dataAccess: DataAccess = createDataAccess({
  firestore: createFirebaseFirestoreDataPort(db),
  saving: { start: startSaving, end: endSaving },
});

import { db } from "../firebase";
import { createFirebaseFirestoreDataPort } from "../firestoreDataPort/firebaseAdapter";
import { endSaving, startSaving } from "../savingStore";
import { buildCatalogDataPort } from "./ports/catalogPort";
import { buildTemplateDataPort } from "./ports/templatePort";
import { buildWorkoutDataPort } from "./ports/workoutPort";
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
  const catalogPort = buildCatalogDataPort(deps);
  const templatePort = buildTemplateDataPort(deps);
  const workoutPort = buildWorkoutDataPort(deps);

  const exercises = catalogPort.exercises;
  const days = catalogPort.days;
  const { templates, resolveExerciseNames } = templatePort;
  const { workouts, sets, exportForBackup } = workoutPort;

  const workoutSession = createWorkoutSessionApi({
    workouts,
    sets,
    templates,
    firestore: deps.firestore,
    saving: deps.saving,
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

import type { FirestoreDataPort } from "../firestoreDataPort/types";
import type { DataAccessSlices } from "./dataAccessSlices";
import type { WorkoutSessionApi } from "./workoutSessionTypes";

export type {
  DataAccessSlices,
  DaysDataSlice,
  ExercisesDataSlice,
  ExportForBackupSlice,
  SetsDataSlice,
  TemplateCatalog,
  TemplatesDataSlice,
  WorkoutsDataSlice,
} from "./dataAccessSlices";

export interface DataAccessDeps {
  firestore: FirestoreDataPort;
  saving: { start: () => void; end: () => void };
}

export interface DataAccess extends DataAccessSlices {
  workoutSession: WorkoutSessionApi;
}

export type CatalogDataPort = Pick<DataAccessSlices, "exercises" | "days">;
export type TemplateDataPort = Pick<
  DataAccessSlices,
  "templates" | "resolveExerciseNames"
>;
export type WorkoutDataPort = Pick<
  DataAccessSlices,
  "workouts" | "sets" | "exportForBackup"
>;

/** Workout detail route: everything needed from `DataAccess` for that screen. */
export type WorkoutDetailDataAccessPort = Pick<DataAccess, "workoutSession">;

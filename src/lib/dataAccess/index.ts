import { db } from "../firebase";
import { createFirebaseFirestoreDataPort } from "../firestoreDataPort/firebaseAdapter";
import { endSaving, startSaving } from "../savingStore";
import { buildCatalogDataPort } from "./ports/catalogPort";
import { buildTemplateDataPort } from "./ports/templatePort";
import { buildWorkoutDataPort } from "./ports/workoutPort";
import type { DataAccess, DataAccessDeps } from "./types";

export type {
  CatalogDataPort,
  DataAccess,
  DataAccessDeps,
  TemplateDataPort,
  WorkoutDataPort,
} from "./types";

export function createDataAccess(deps: DataAccessDeps): DataAccess {
  return {
    ...buildCatalogDataPort(deps),
    ...buildTemplateDataPort(deps),
    ...buildWorkoutDataPort(deps),
  };
}

export const dataAccess: DataAccess = createDataAccess({
  firestore: createFirebaseFirestoreDataPort(db),
  saving: { start: startSaving, end: endSaving },
});

import { buildDaysSlice } from "../daysSlice";
import { buildExercisesSlice } from "../exercisesSlice";
import type { CatalogDataPort, DataAccessDeps } from "../types";

export function buildCatalogDataPort(deps: DataAccessDeps): CatalogDataPort {
  const { firestore, saving } = deps;
  return {
    exercises: buildExercisesSlice(firestore, saving),
    days: buildDaysSlice(firestore, saving),
  };
}

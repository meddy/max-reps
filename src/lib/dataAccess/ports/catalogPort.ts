import { buildDaysSlice } from "../daysSlice";
import { buildExercisesSlice } from "../exercisesSlice";
import type { CatalogDataPort, DataAccessDeps } from "../types";

export function buildCatalogDataPort(deps: DataAccessDeps): CatalogDataPort {
  const { db, saving } = deps;
  return {
    exercises: buildExercisesSlice(db, saving),
    days: buildDaysSlice(db, saving),
  };
}

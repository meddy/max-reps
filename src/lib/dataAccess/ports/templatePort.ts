import { buildTemplatesSlice } from "../templatesSlice";
import { resolveExerciseNamesImpl } from "../templateQueries";
import type { DataAccessDeps, TemplateDataPort } from "../types";

export function buildTemplateDataPort(deps: DataAccessDeps): TemplateDataPort {
  const { db } = deps;
  return {
    templates: buildTemplatesSlice(db, deps.saving),
    resolveExerciseNames(ids: string[]) {
      return resolveExerciseNamesImpl(db, ids);
    },
  };
}

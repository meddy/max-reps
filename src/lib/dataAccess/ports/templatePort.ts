import { buildTemplatesSlice } from "../templatesSlice";
import { resolveExerciseNamesImpl } from "../templateQueries";
import type { DataAccessDeps, TemplateDataPort } from "../types";

export function buildTemplateDataPort(deps: DataAccessDeps): TemplateDataPort {
  const { firestore } = deps;
  return {
    templates: buildTemplatesSlice(firestore, deps.saving),
    resolveExerciseNames(ids: string[]) {
      return resolveExerciseNamesImpl(firestore, ids);
    },
  };
}

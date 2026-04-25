import type { Exercise } from "../../types";
import type { ExercisesSliceFirestorePort } from "../firestoreDataPort/types";
import { mapExerciseFromDoc } from "../firestoreModelMappers";
import { DEFAULT_PAGE } from "./constants";
import type { DataAccessDeps } from "./types";
import { withSaving } from "./withSaving";

export function buildExercisesSlice(
  firestore: ExercisesSliceFirestorePort,
  saving: DataAccessDeps["saving"]
) {
  const SEARCH_LIST_LIMIT = 1000;

  return {
    async get(id: string): Promise<Exercise | null> {
      const raw = await firestore.getDocument("exercises", id);
      if (!raw) return null;
      return mapExerciseFromDoc(raw.id, raw.data);
    },

    async searchByNamePrefix(prefix: string, max = 20): Promise<Exercise[]> {
      const term = prefix.trim().toLowerCase();
      if (!term) return [];
      const rows = await firestore.queryExercisesByNamePrefix(term, max);
      return rows.map((d) => mapExerciseFromDoc(d.id, d.data));
    },

    async findByExactName(nameLower: string): Promise<Exercise | null> {
      const raw = await firestore.queryExerciseByNameLowerEqual(nameLower);
      if (!raw) return null;
      return mapExerciseFromDoc(raw.id, raw.data);
    },

    async listAllForSearch(limit = SEARCH_LIST_LIMIT) {
      const rows = await firestore.queryExercisesList({
        sort: "asc",
        limit,
      });
      return rows.map((d) => mapExerciseFromDoc(d.id, d.data));
    },

    async create(input: {
      nameLower: string;
      displayName: string;
    }): Promise<string> {
      return withSaving(saving, () =>
        firestore.addDocument("exercises", input as Record<string, unknown>)
      );
    },

    async update(
      id: string,
      patch: Partial<Pick<Exercise, "nameLower" | "displayName">>
    ): Promise<void> {
      return withSaving(saving, () =>
        firestore.patchDocument("exercises", id, patch)
      );
    },

    async delete(id: string): Promise<void> {
      return withSaving(saving, () =>
        firestore.removeDocument("exercises", id)
      );
    },

    async list(opts: {
      sort: "asc" | "desc";
      search?: string;
      limit?: number;
    }): Promise<Array<Exercise & { id: string }>> {
      const lim = opts.limit ?? DEFAULT_PAGE;
      const rows = await firestore.queryExercisesList({
        sort: opts.sort,
        search: opts.search,
        limit: lim,
      });
      return rows.map((d) => mapExerciseFromDoc(d.id, d.data));
    },
  };
}

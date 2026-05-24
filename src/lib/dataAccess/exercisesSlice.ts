import type { Exercise } from "../../types";
import type { ExercisesSliceFirestorePort } from "../firestoreDataPort/types";
import { mapExerciseFromDoc } from "../firestoreModelMappers";
import { DEFAULT_PAGE } from "./constants";
import {
  findInExerciseCatalog,
  getExerciseCatalog,
  patchExerciseCatalog,
  removeFromExerciseCatalog,
} from "./exerciseCatalogCache";
import type { DataAccessDeps } from "./types";
import { withSaving } from "./withSaving";

export { clearExerciseCatalogCache } from "./exerciseCatalogCache";

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

    async listAllForSearch(opts?: { limit?: number; force?: boolean }) {
      const limit = opts?.limit ?? SEARCH_LIST_LIMIT;
      return getExerciseCatalog(
        async () => {
          const rows = await firestore.queryExercisesList({
            sort: "asc",
            limit,
          });
          return rows.map((d) => mapExerciseFromDoc(d.id, d.data));
        },
        { force: opts?.force }
      );
    },

    async create(input: {
      nameLower: string;
      displayName: string;
    }): Promise<string> {
      const id = await withSaving(saving, () =>
        firestore.addDocument("exercises", input as Record<string, unknown>)
      );
      const now = new Date();
      patchExerciseCatalog({
        id,
        nameLower: input.nameLower,
        displayName: input.displayName,
        createdAt: now,
        updatedAt: now,
      });
      return id;
    },

    async update(
      id: string,
      patch: Partial<Pick<Exercise, "nameLower" | "displayName">>
    ): Promise<void> {
      await withSaving(saving, () =>
        firestore.patchDocument("exercises", id, patch)
      );
      const existing = findInExerciseCatalog(id);
      if (existing) {
        patchExerciseCatalog({
          ...existing,
          ...patch,
          updatedAt: new Date(),
        });
      }
    },

    async delete(id: string): Promise<void> {
      await withSaving(saving, () => firestore.removeDocument("exercises", id));
      removeFromExerciseCatalog(id);
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

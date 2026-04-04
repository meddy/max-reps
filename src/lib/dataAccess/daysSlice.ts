import type { Day } from "../../types";
import type { FirestoreDataPort } from "../firestoreDataPort/types";
import { mapDayFromDoc } from "../firestoreModelMappers";
import { DEFAULT_PAGE } from "./constants";
import type { DataAccessDeps } from "./types";
import { withSaving } from "./withSaving";

export function buildDaysSlice(
  firestore: FirestoreDataPort,
  saving: DataAccessDeps["saving"]
) {
  return {
    async get(id: string): Promise<Day | null> {
      const raw = await firestore.getDocument("days", id);
      if (!raw) return null;
      return mapDayFromDoc(raw.id, raw.data);
    },

    async searchByNamePrefix(
      prefix: string,
      max = 20
    ): Promise<Array<Day & { id: string }>> {
      const term = prefix.trim().toLowerCase();
      if (!term) return [];
      const rows = await firestore.queryDaysByNamePrefix(term, max);
      return rows.map((d) => mapDayFromDoc(d.id, d.data));
    },

    async findByExactName(nameLower: string): Promise<Day | null> {
      const raw = await firestore.queryDayByNameLowerEqual(nameLower);
      if (!raw) return null;
      return mapDayFromDoc(raw.id, raw.data);
    },

    async create(input: {
      nameLower: string;
      displayName: string;
    }): Promise<string> {
      return withSaving(saving, () =>
        firestore.addDocument("days", input as Record<string, unknown>)
      );
    },

    async update(
      id: string,
      patch: Partial<Pick<Day, "nameLower" | "displayName">>
    ): Promise<void> {
      return withSaving(saving, () =>
        firestore.patchDocument("days", id, patch)
      );
    },

    async deleteWithTemplates(id: string): Promise<void> {
      return withSaving(saving, () =>
        firestore.removeDocumentAndRelated("days", id, [
          { collection: "exerciseSetTemplates", field: "dayId" },
        ])
      );
    },

    async list(opts: {
      sort: "asc" | "desc";
      limit?: number;
    }): Promise<Array<Day & { id: string }>> {
      const lim = opts.limit ?? DEFAULT_PAGE;
      const rows = await firestore.queryDaysList({
        sort: opts.sort,
        limit: lim,
      });
      return rows.map((d) => mapDayFromDoc(d.id, d.data));
    },
  };
}

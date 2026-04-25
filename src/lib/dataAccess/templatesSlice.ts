import type { ExerciseSetTemplate } from "../../types";
import type { TemplatesSliceFirestorePort } from "../firestoreDataPort/types";
import type { DataAccessDeps } from "./types";
import { templatesWithNamesForDayIds } from "./templateQueries";
import { withSaving } from "./withSaving";

export function buildTemplatesSlice(
  firestore: TemplatesSliceFirestorePort,
  saving: DataAccessDeps["saving"]
) {
  const catalog = {
    async forDay(dayId: string) {
      const map = await templatesWithNamesForDayIds(firestore, [dayId]);
      return map.get(dayId) ?? [];
    },

    async forDays(dayIds: string[]) {
      return templatesWithNamesForDayIds(firestore, dayIds);
    },
  };

  return {
    catalog,

    forDay: catalog.forDay,
    forDays: catalog.forDays,

    listForDayWithExerciseNames(dayId: string) {
      return catalog.forDay(dayId);
    },

    listForDaysWithExerciseNames(dayIds: string[]) {
      return catalog.forDays(dayIds);
    },

    async create(
      input: Omit<ExerciseSetTemplate, "id" | "createdAt" | "updatedAt">
    ): Promise<string> {
      return withSaving(saving, () =>
        firestore.addDocument(
          "exerciseSetTemplates",
          input as Record<string, unknown>
        )
      );
    },

    async update(
      id: string,
      patch: Partial<
        Omit<ExerciseSetTemplate, "id" | "createdAt" | "updatedAt">
      >
    ): Promise<void> {
      return withSaving(saving, () =>
        firestore.patchDocument("exerciseSetTemplates", id, patch)
      );
    },

    async reorder(
      updates: Array<{ id: string; order: number }>
    ): Promise<void> {
      if (updates.length === 0) return;
      return withSaving(saving, () =>
        firestore.patchDocuments(
          updates.map(({ id, order }) => ({
            collectionName: "exerciseSetTemplates" as const,
            id,
            data: { order },
          }))
        )
      );
    },

    async delete(id: string): Promise<void> {
      return withSaving(saving, () =>
        firestore.removeDocument("exerciseSetTemplates", id)
      );
    },
  };
}

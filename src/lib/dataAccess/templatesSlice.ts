import type { ExerciseSetTemplate } from "../../types";
import type { FirestoreDataPort } from "../firestoreDataPort/types";
import type { DataAccessDeps } from "./types";
import { templatesWithNamesForDayIds } from "./templateQueries";
import { withSaving } from "./withSaving";

export function buildTemplatesSlice(
  firestore: FirestoreDataPort,
  saving: DataAccessDeps["saving"]
) {
  return {
    async listForDayWithExerciseNames(dayId: string) {
      const map = await templatesWithNamesForDayIds(firestore, [dayId]);
      return map.get(dayId) ?? [];
    },

    async listForDaysWithExerciseNames(dayIds: string[]) {
      return templatesWithNamesForDayIds(firestore, dayIds);
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

    async delete(id: string): Promise<void> {
      return withSaving(saving, () =>
        firestore.removeDocument("exerciseSetTemplates", id)
      );
    },
  };
}

import type { Firestore } from "firebase/firestore";
import { addDocument, patchDocument, removeDocument } from "../firestoreWrites";
import type { ExerciseSetTemplate } from "../../types";
import type { DataAccessDeps } from "./types";
import { templatesWithNamesForDayIds } from "./templateQueries";
import { withSaving } from "./withSaving";

export function buildTemplatesSlice(
  firestore: Firestore,
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
        addDocument(
          firestore,
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
        patchDocument(firestore, "exerciseSetTemplates", id, patch)
      );
    },

    async delete(id: string): Promise<void> {
      return withSaving(saving, () =>
        removeDocument(firestore, "exerciseSetTemplates", id)
      );
    },
  };
}

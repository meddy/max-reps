import type { WorkoutSet } from "../../types";
import type { SetsSliceFirestorePort } from "../firestoreDataPort/types";
import { mapWorkoutSetFromDoc } from "../firestoreModelMappers";
import type { DataAccessDeps } from "./types";
import { withSaving } from "./withSaving";

export function buildSetsSlice(
  firestore: SetsSliceFirestorePort,
  saving: DataAccessDeps["saving"]
) {
  return {
    async listForWorkout(workoutId: string): Promise<WorkoutSet[]> {
      const rows = await firestore.querySetsForWorkoutOrdered(workoutId);
      return rows.map((d) => mapWorkoutSetFromDoc(d.id, d.data));
    },

    async lastPerformedGroupForExercise(
      exerciseId: string,
      excludeWorkoutId?: string
    ): Promise<{
      sets: Array<{ reps: number; weight: number; note?: string }>;
      workoutId?: string;
    }> {
      const rows = await firestore.querySetsByExercisePerformedAtDesc(
        exerciseId,
        50
      );
      if (rows.length === 0) return { sets: [] };
      const docs = rows.map((d) => mapWorkoutSetFromDoc(d.id, d.data));
      const targetWorkoutId = docs.find(
        (d) => !excludeWorkoutId || d.workoutId !== excludeWorkoutId
      )?.workoutId;
      if (!targetWorkoutId) return { sets: [] };
      const group = docs
        .filter((d) => d.workoutId === targetWorkoutId)
        .sort((a, b) => a.order - b.order);
      return {
        sets: group.map((s) => ({
          reps: s.reps,
          weight: s.weight,
          note: s.note,
        })),
        workoutId: targetWorkoutId,
      };
    },

    async listForExercise(
      exerciseId: string,
      opts?: { limit?: number }
    ): Promise<Array<WorkoutSet & { id: string }>> {
      const lim = opts?.limit ?? 100;
      const rows = await firestore.querySetsByExercisePerformedAtDesc(
        exerciseId,
        lim
      );
      return rows.map((d) => mapWorkoutSetFromDoc(d.id, d.data));
    },

    async prForExercise(
      exerciseId: string
    ): Promise<(WorkoutSet & { id: string }) | null> {
      const raw = await firestore.querySetsPrForExercise(exerciseId);
      if (!raw) return null;
      return mapWorkoutSetFromDoc(raw.id, raw.data);
    },

    async create(input: Omit<WorkoutSet, "id" | "createdAt">): Promise<string> {
      return withSaving(saving, () =>
        firestore.addDocument("sets", input as Record<string, unknown>)
      );
    },

    async update(
      id: string,
      patch: Partial<Omit<WorkoutSet, "id" | "createdAt">>
    ): Promise<void> {
      return withSaving(saving, () =>
        firestore.patchDocument("sets", id, patch as Record<string, unknown>)
      );
    },

    async reorder(
      updates: Array<{ id: string; order: number }>
    ): Promise<void> {
      if (updates.length === 0) return;
      return withSaving(saving, () =>
        firestore.patchDocuments(
          updates.map(({ id, order }) => ({
            collectionName: "sets" as const,
            id,
            data: { order },
          }))
        )
      );
    },

    async delete(id: string): Promise<void> {
      return withSaving(saving, () => firestore.removeDocument("sets", id));
    },
  };
}

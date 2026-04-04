import type { Firestore } from "firebase/firestore";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import type { WorkoutSet } from "../../types";
import {
  addDocument,
  patchDocument,
  removeDocument,
} from "../firestorePersistence";
import { mapWorkoutSetFromDoc } from "../firestoreModelMappers";
import type { DataAccessDeps } from "./types";
import { withSaving } from "./withSaving";

export function buildSetsSlice(
  firestore: Firestore,
  saving: DataAccessDeps["saving"]
) {
  return {
    async listForWorkout(workoutId: string): Promise<WorkoutSet[]> {
      const q = query(
        collection(firestore, "sets"),
        where("workoutId", "==", workoutId),
        orderBy("order"),
        limit(500)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) =>
        mapWorkoutSetFromDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async lastPerformedGroupForExercise(
      exerciseId: string,
      excludeWorkoutId?: string
    ): Promise<{
      sets: Array<{ reps: number; weight: number; note?: string }>;
      workoutId?: string;
    }> {
      const sq = query(
        collection(firestore, "sets"),
        where("exerciseId", "==", exerciseId),
        orderBy("performedAt", "desc"),
        limit(50)
      );
      const sSnap = await getDocs(sq);
      if (sSnap.empty) return { sets: [] };
      const docs = sSnap.docs.map((d) =>
        mapWorkoutSetFromDoc(d.id, d.data() as Record<string, unknown>)
      );
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
      const setsRef = query(
        collection(firestore, "sets"),
        where("exerciseId", "==", exerciseId),
        orderBy("performedAt", "desc"),
        limit(lim)
      );
      const setsSnap = await getDocs(setsRef);
      return setsSnap.docs.map((d) =>
        mapWorkoutSetFromDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async prForExercise(
      exerciseId: string
    ): Promise<(WorkoutSet & { id: string }) | null> {
      const prRef = query(
        collection(firestore, "sets"),
        where("exerciseId", "==", exerciseId),
        orderBy("weight", "desc"),
        orderBy("reps", "desc"),
        limit(1)
      );
      const prSnap = await getDocs(prRef);
      if (prSnap.empty) return null;
      const d = prSnap.docs[0];
      return mapWorkoutSetFromDoc(d.id, d.data() as Record<string, unknown>);
    },

    async create(input: Omit<WorkoutSet, "id" | "createdAt">): Promise<string> {
      return withSaving(saving, () =>
        addDocument(firestore, "sets", input as Record<string, unknown>)
      );
    },

    async update(
      id: string,
      patch: Partial<Omit<WorkoutSet, "id" | "createdAt">>
    ): Promise<void> {
      return withSaving(saving, () =>
        patchDocument(firestore, "sets", id, patch as Record<string, unknown>)
      );
    },

    async delete(id: string): Promise<void> {
      return withSaving(saving, () => removeDocument(firestore, "sets", id));
    },
  };
}

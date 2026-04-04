import type { Firestore } from "firebase/firestore";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import type { Workout, WorkoutListItem, WorkoutSet } from "../../types";
import {
  addDocument,
  patchDocument,
  removeDocumentAndRelated,
} from "../firestoreWrites";
import {
  mapWorkoutFromDoc,
  mapWorkoutSetFromDoc,
} from "../firestoreModelMappers";
import { DEFAULT_PAGE } from "./constants";
import type { DataAccessDeps } from "./types";
import { withSaving } from "./withSaving";

export function buildWorkoutsSlice(
  firestore: Firestore,
  saving: DataAccessDeps["saving"]
) {
  return {
    async get(id: string): Promise<(Workout & { id: string }) | null> {
      const snap = await getDoc(doc(firestore, "workouts", id));
      if (!snap.exists()) return null;
      return mapWorkoutFromDoc(snap.id, snap.data() as Record<string, unknown>);
    },

    async getWithSets(id: string): Promise<{
      workout: Workout & { id: string };
      sets: WorkoutSet[];
    } | null> {
      const snap = await getDoc(doc(firestore, "workouts", id));
      if (!snap.exists()) return null;
      const workout = mapWorkoutFromDoc(
        snap.id,
        snap.data() as Record<string, unknown>
      );
      const sq = query(
        collection(firestore, "sets"),
        where("workoutId", "==", id),
        orderBy("order"),
        limit(500)
      );
      const snapshot = await getDocs(sq);
      const sets = snapshot.docs.map((d) =>
        mapWorkoutSetFromDoc(d.id, d.data() as Record<string, unknown>)
      );
      return { workout, sets };
    },

    async create(input: {
      date: Date;
      dayId: string;
      dayNameSnapshot: string;
      note?: string;
    }): Promise<string> {
      return withSaving(saving, () =>
        addDocument(firestore, "workouts", {
          ...input,
          note: input.note ?? "",
        } as Record<string, unknown>)
      );
    },

    async update(
      id: string,
      patch: Partial<
        Pick<Workout, "date" | "dayId" | "dayNameSnapshot" | "note">
      >
    ): Promise<void> {
      return withSaving(saving, () =>
        patchDocument(
          firestore,
          "workouts",
          id,
          patch as Record<string, unknown>
        )
      );
    },

    async deleteWithSets(id: string): Promise<void> {
      return withSaving(saving, () =>
        removeDocumentAndRelated(firestore, "workouts", id, [
          { collection: "sets", field: "workoutId" },
        ])
      );
    },

    async getNotesByWorkoutIds(ids: string[]): Promise<Record<string, string>> {
      const notes: Record<string, string> = {};
      await Promise.all(
        ids.map(async (wid) => {
          const snap = await getDoc(doc(firestore, "workouts", wid));
          if (snap.exists()) {
            const note = (snap.data() as Workout).note;
            if (note) notes[wid] = note;
          }
        })
      );
      return notes;
    },

    async listWithStats(opts: {
      sort: "asc" | "desc";
      limit?: number;
    }): Promise<WorkoutListItem[]> {
      const lim = opts.limit ?? DEFAULT_PAGE;
      const ref = collection(firestore, "workouts");
      const q = query(ref, orderBy("date", opts.sort), limit(lim));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((d) =>
        mapWorkoutFromDoc(d.id, d.data() as Record<string, unknown>)
      );
      const withCounts = await Promise.all(
        list.map(async (w) => {
          const setsSnap = await getDocs(
            query(collection(firestore, "sets"), where("workoutId", "==", w.id))
          );
          const exerciseIds = new Set<string>();
          let totalLoad = 0;
          setsSnap.docs.forEach((d) => {
            const data = d.data();
            exerciseIds.add(data.exerciseId as string);
            totalLoad +=
              ((data.reps as number) ?? 0) * ((data.weight as number) ?? 0);
          });
          return {
            ...w,
            setCount: setsSnap.size,
            exerciseCount: exerciseIds.size,
            totalLoad,
          } as WorkoutListItem;
        })
      );
      return withCounts;
    },
  };
}

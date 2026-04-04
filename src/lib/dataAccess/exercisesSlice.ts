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
import type { Exercise } from "../../types";
import {
  addDocument,
  patchDocument,
  removeDocument,
} from "../firestorePersistence";
import { mapExerciseFromDoc } from "../firestoreModelMappers";
import { DEFAULT_PAGE } from "./constants";
import type { DataAccessDeps } from "./types";
import { withSaving } from "./withSaving";

export function buildExercisesSlice(
  firestore: Firestore,
  saving: DataAccessDeps["saving"]
) {
  return {
    async get(id: string): Promise<Exercise | null> {
      const snap = await getDoc(doc(firestore, "exercises", id));
      if (!snap.exists()) return null;
      return mapExerciseFromDoc(
        snap.id,
        snap.data() as Record<string, unknown>
      );
    },

    async searchByNamePrefix(prefix: string, max = 20): Promise<Exercise[]> {
      const term = prefix.trim().toLowerCase();
      if (!term) return [];
      const ref = collection(firestore, "exercises");
      const q = query(
        ref,
        where("nameLower", ">=", term),
        where("nameLower", "<=", term + "\uf8ff"),
        orderBy("nameLower"),
        limit(max)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) =>
        mapExerciseFromDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async findByExactName(nameLower: string): Promise<Exercise | null> {
      const ref = collection(firestore, "exercises");
      const q = query(ref, where("nameLower", "==", nameLower), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return mapExerciseFromDoc(d.id, d.data() as Record<string, unknown>);
    },

    async create(input: {
      nameLower: string;
      displayName: string;
    }): Promise<string> {
      return withSaving(saving, () =>
        addDocument(firestore, "exercises", input as Record<string, unknown>)
      );
    },

    async update(
      id: string,
      patch: Partial<Pick<Exercise, "nameLower" | "displayName">>
    ): Promise<void> {
      return withSaving(saving, () =>
        patchDocument(firestore, "exercises", id, patch)
      );
    },

    async delete(id: string): Promise<void> {
      return withSaving(saving, () =>
        removeDocument(firestore, "exercises", id)
      );
    },

    async list(opts: {
      sort: "asc" | "desc";
      search?: string;
      limit?: number;
    }): Promise<Array<Exercise & { id: string }>> {
      const lim = opts.limit ?? DEFAULT_PAGE;
      const ref = collection(firestore, "exercises");
      const search = opts.search?.trim().toLowerCase();
      const q = search
        ? query(
            ref,
            where("nameLower", ">=", search),
            where("nameLower", "<=", search + "\uf8ff"),
            orderBy("nameLower", opts.sort),
            limit(lim)
          )
        : query(ref, orderBy("nameLower", opts.sort), limit(lim));
      const snap = await getDocs(q);
      return snap.docs.map((d) =>
        mapExerciseFromDoc(d.id, d.data() as Record<string, unknown>)
      );
    },
  };
}

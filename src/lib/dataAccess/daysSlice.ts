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
import type { Day } from "../../types";
import {
  addDocument,
  patchDocument,
  removeDocumentAndRelated,
} from "../firestoreWrites";
import { mapDayFromDoc } from "../firestoreModelMappers";
import { DEFAULT_PAGE } from "./constants";
import type { DataAccessDeps } from "./types";
import { withSaving } from "./withSaving";

export function buildDaysSlice(
  firestore: Firestore,
  saving: DataAccessDeps["saving"]
) {
  return {
    async get(id: string): Promise<Day | null> {
      const snap = await getDoc(doc(firestore, "days", id));
      if (!snap.exists()) return null;
      return mapDayFromDoc(snap.id, snap.data() as Record<string, unknown>);
    },

    async searchByNamePrefix(
      prefix: string,
      max = 20
    ): Promise<Array<Day & { id: string }>> {
      const term = prefix.trim().toLowerCase();
      if (!term) return [];
      const ref = collection(firestore, "days");
      const q = query(
        ref,
        where("nameLower", ">=", term),
        where("nameLower", "<=", term + "\uf8ff"),
        orderBy("nameLower"),
        limit(max)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) =>
        mapDayFromDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async findByExactName(nameLower: string): Promise<Day | null> {
      const ref = collection(firestore, "days");
      const q = query(ref, where("nameLower", "==", nameLower), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return mapDayFromDoc(d.id, d.data() as Record<string, unknown>);
    },

    async create(input: {
      nameLower: string;
      displayName: string;
    }): Promise<string> {
      return withSaving(saving, () =>
        addDocument(firestore, "days", input as Record<string, unknown>)
      );
    },

    async update(
      id: string,
      patch: Partial<Pick<Day, "nameLower" | "displayName">>
    ): Promise<void> {
      return withSaving(saving, () =>
        patchDocument(firestore, "days", id, patch)
      );
    },

    async deleteWithTemplates(id: string): Promise<void> {
      return withSaving(saving, () =>
        removeDocumentAndRelated(firestore, "days", id, [
          { collection: "exerciseSetTemplates", field: "dayId" },
        ])
      );
    },

    async list(opts: {
      sort: "asc" | "desc";
      limit?: number;
    }): Promise<Array<Day & { id: string }>> {
      const lim = opts.limit ?? DEFAULT_PAGE;
      const ref = collection(firestore, "days");
      const q = query(ref, orderBy("nameLower", opts.sort), limit(lim));
      const snap = await getDocs(q);
      return snap.docs.map((d) =>
        mapDayFromDoc(d.id, d.data() as Record<string, unknown>)
      );
    },
  };
}

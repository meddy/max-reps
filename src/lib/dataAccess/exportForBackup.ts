import type { Firestore } from "firebase/firestore";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import type { CollectionName } from "../../types";

const COLLECTIONS = [
  "exercises",
  "days",
  "exerciseSetTemplates",
  "workouts",
  "sets",
] as const satisfies readonly CollectionName[];

export function buildExportForBackup(firestore: Firestore) {
  return {
    async allCollectionsRaw(): Promise<
      Record<CollectionName, Array<{ id: string } & Record<string, unknown>>>
    > {
      const results = await Promise.all(
        COLLECTIONS.map(async (name) => {
          const ref = collection(firestore, name);
          const q = query(ref, limit(10000));
          const snap = await getDocs(q);
          return [
            name,
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            })),
          ] as const;
        })
      );
      return Object.fromEntries(results) as Record<
        CollectionName,
        Array<{ id: string } & Record<string, unknown>>
      >;
    },

    async setsDocumentsForCsv(
      limitCount: number
    ): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
      const ref = collection(firestore, "sets");
      const q = query(ref, orderBy("performedAt", "desc"), limit(limitCount));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        id: d.id,
        data: d.data() as Record<string, unknown>,
      }));
    },
  };
}

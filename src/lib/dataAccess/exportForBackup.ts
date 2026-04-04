import type { CollectionName } from "../../types";
import type { FirestoreDataPort } from "../firestoreDataPort/types";

const COLLECTIONS = [
  "exercises",
  "days",
  "exerciseSetTemplates",
  "workouts",
  "sets",
] as const satisfies readonly CollectionName[];

export function buildExportForBackup(firestore: FirestoreDataPort) {
  return {
    async allCollectionsRaw(): Promise<
      Record<CollectionName, Array<{ id: string } & Record<string, unknown>>>
    > {
      const results = await Promise.all(
        COLLECTIONS.map(async (name) => {
          const rows = await firestore.queryCollectionDocuments(name, 10000);
          return [
            name,
            rows.map((d) => ({
              id: d.id,
              ...d.data,
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
      const rows = await firestore.querySetsDocumentsForCsv(limitCount);
      return rows.map((d) => ({
        id: d.id,
        data: d.data,
      }));
    },
  };
}

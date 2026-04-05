import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectionName } from "../../types";
import type { FirestoreDataPort, RawDoc } from "../firestoreDataPort/types";
import { createStubFirestoreDataPort } from "../../test/stubFirestoreDataPort";
import { buildExportForBackup } from "./exportForBackup";

const COLLECTION_ORDER: CollectionName[] = [
  "exercises",
  "days",
  "exerciseSetTemplates",
  "workouts",
  "sets",
];

describe("buildExportForBackup", () => {
  let port: FirestoreDataPort;
  let queryCollectionDocuments: ReturnType<typeof vi.fn>;
  let querySetsDocumentsForCsv: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryCollectionDocuments = vi
      .fn()
      .mockImplementation(
        async (_name: CollectionName): Promise<RawDoc[]> => []
      );
    querySetsDocumentsForCsv = vi.fn().mockResolvedValue([] as RawDoc[]);
    port = createStubFirestoreDataPort({
      queryCollectionDocuments:
        queryCollectionDocuments as FirestoreDataPort["queryCollectionDocuments"],
      querySetsDocumentsForCsv:
        querySetsDocumentsForCsv as FirestoreDataPort["querySetsDocumentsForCsv"],
    });
  });

  describe("allCollectionsRaw", () => {
    it("queries each backup collection with limit 10000 and merges id and data", async () => {
      queryCollectionDocuments.mockImplementation(
        async (name: CollectionName): Promise<RawDoc[]> => {
          if (name === "exercises") {
            return [{ id: "e1", data: { displayName: "Squat" } }];
          }
          return [];
        }
      );

      const { allCollectionsRaw } = buildExportForBackup(port);
      const out = await allCollectionsRaw();

      expect(queryCollectionDocuments.mock.calls.map((c) => c[0])).toEqual(
        COLLECTION_ORDER
      );
      for (const call of queryCollectionDocuments.mock.calls) {
        expect(call[1]).toBe(10000);
      }

      expect(out.exercises).toEqual([{ id: "e1", displayName: "Squat" }]);
      expect(out.days).toEqual([]);
      expect(out.exerciseSetTemplates).toEqual([]);
      expect(out.workouts).toEqual([]);
      expect(out.sets).toEqual([]);
    });

    it("returns empty arrays when the port returns no rows", async () => {
      const { allCollectionsRaw } = buildExportForBackup(port);
      const out = await allCollectionsRaw();

      expect(out.exercises).toEqual([]);
      expect(queryCollectionDocuments).toHaveBeenCalledTimes(
        COLLECTION_ORDER.length
      );
    });
  });

  describe("setsDocumentsForCsv", () => {
    it("delegates to querySetsDocumentsForCsv with the given limit", async () => {
      const rows: RawDoc[] = [{ id: "s1", data: { workoutId: "w1", reps: 5 } }];
      querySetsDocumentsForCsv.mockResolvedValue(rows);

      const { setsDocumentsForCsv } = buildExportForBackup(port);
      const out = await setsDocumentsForCsv(500);

      expect(querySetsDocumentsForCsv).toHaveBeenCalledWith(500);
      expect(out).toEqual([{ id: "s1", data: { workoutId: "w1", reps: 5 } }]);
    });

    it("returns empty when the port returns no sets", async () => {
      const { setsDocumentsForCsv } = buildExportForBackup(port);
      const out = await setsDocumentsForCsv(10000);

      expect(out).toEqual([]);
      expect(querySetsDocumentsForCsv).toHaveBeenCalledWith(10000);
    });
  });
});

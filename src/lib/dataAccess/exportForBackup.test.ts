import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectionName } from "../../types";
import type { FirestoreDataPort, RawDoc } from "../firestoreDataPort/types";
import { buildExportForBackup } from "./exportForBackup";

const COLLECTION_ORDER: CollectionName[] = [
  "exercises",
  "days",
  "exerciseSetTemplates",
  "workouts",
  "sets",
];

function createFakePort(
  overrides: Partial<FirestoreDataPort> = {}
): FirestoreDataPort {
  const queryCollectionDocuments = vi
    .fn()
    .mockImplementation(async (_name: CollectionName): Promise<RawDoc[]> => []);
  const querySetsDocumentsForCsv = vi.fn().mockResolvedValue([] as RawDoc[]);

  const reject = (): never => {
    throw new Error("not implemented in fake");
  };

  return {
    getDocument: vi.fn(reject),
    addDocument: vi.fn(reject),
    patchDocument: vi.fn(reject),
    removeDocument: vi.fn(reject),
    removeDocumentAndRelated: vi.fn(reject),
    queryExercisesByNamePrefix: vi.fn(reject),
    queryExerciseByNameLowerEqual: vi.fn(reject),
    queryExercisesList: vi.fn(reject),
    queryDaysByNamePrefix: vi.fn(reject),
    queryDayByNameLowerEqual: vi.fn(reject),
    queryDaysList: vi.fn(reject),
    querySetsForWorkoutOrdered: vi.fn(reject),
    queryWorkoutsByDate: vi.fn(reject),
    querySetsByWorkoutId: vi.fn(reject),
    querySetsByExercisePerformedAtDesc: vi.fn(reject),
    querySetsPrForExercise: vi.fn(reject),
    queryExercisesWhereDocumentIdIn: vi.fn(reject),
    queryTemplatesWhereDayIdIn: vi.fn(reject),
    queryCollectionDocuments,
    querySetsDocumentsForCsv,
    ...overrides,
  };
}

describe("buildExportForBackup", () => {
  let port: FirestoreDataPort;
  let queryCollectionDocuments: ReturnType<typeof vi.fn>;
  let querySetsDocumentsForCsv: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const fake = createFakePort();
    port = fake;
    queryCollectionDocuments = fake.queryCollectionDocuments as ReturnType<
      typeof vi.fn
    >;
    querySetsDocumentsForCsv = fake.querySetsDocumentsForCsv as ReturnType<
      typeof vi.fn
    >;
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

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FirestoreDataPort } from "../firestoreDataPort/types";
import {
  resolveExerciseNamesImpl,
  templatesWithNamesForDayIds,
} from "./templateQueries";

function stubPort(partial: Partial<FirestoreDataPort>): FirestoreDataPort {
  const reject = () => Promise.reject(new Error("stub"));
  return {
    getDocument: vi.fn(reject),
    addDocument: vi.fn(reject),
    patchDocument: vi.fn(reject),
    removeDocument: vi.fn(reject),
    removeDocumentAndRelated: vi.fn(reject),
    syncWorkoutDateAndSetsPerformedAt: vi.fn(reject),
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
    queryCollectionDocuments: vi.fn(reject),
    querySetsDocumentsForCsv: vi.fn(reject),
    ...partial,
  };
}

describe("resolveExerciseNamesImpl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty map for empty input without querying", async () => {
    const queryExercisesWhereDocumentIdIn = vi.fn();
    const port = stubPort({ queryExercisesWhereDocumentIdIn });
    const map = await resolveExerciseNamesImpl(port, []);
    expect(map.size).toBe(0);
    expect(queryExercisesWhereDocumentIdIn).not.toHaveBeenCalled();
  });

  it("dedupes ids and uses a single port query for unique exercise ids", async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `e${i}`);
    const queryExercisesWhereDocumentIdIn = vi.fn().mockResolvedValue(
      ids.map((id) => ({
        id,
        data: { displayName: `Name ${id}` },
      }))
    );
    const port = stubPort({ queryExercisesWhereDocumentIdIn });

    const map = await resolveExerciseNamesImpl(port, [...ids, "e0"]);

    expect(queryExercisesWhereDocumentIdIn).toHaveBeenCalledTimes(1);
    expect(queryExercisesWhereDocumentIdIn).toHaveBeenCalledWith(ids);
    expect(map.get("e0")).toBe("Name e0");
    expect(map.get("e10")).toBe("Name e10");
  });

  it("skips entries without displayName", async () => {
    const queryExercisesWhereDocumentIdIn = vi.fn().mockResolvedValue([
      { id: "a", data: { displayName: "Lift" } },
      { id: "b", data: {} },
    ]);
    const port = stubPort({ queryExercisesWhereDocumentIdIn });

    const map = await resolveExerciseNamesImpl(port, ["a", "b"]);
    expect(map.has("a")).toBe(true);
    expect(map.has("b")).toBe(false);
  });
});

describe("templatesWithNamesForDayIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty map for empty day id list without querying", async () => {
    const queryTemplatesWhereDayIdIn = vi.fn();
    const port = stubPort({ queryTemplatesWhereDayIdIn });

    const map = await templatesWithNamesForDayIds(port, []);

    expect(map.size).toBe(0);
    expect(queryTemplatesWhereDayIdIn).not.toHaveBeenCalled();
  });

  it("loads templates for a single day and resolves exercise names", async () => {
    const queryTemplatesWhereDayIdIn = vi.fn().mockResolvedValue([
      {
        id: "t1",
        data: {
          dayId: "d1",
          exerciseId: "e1",
          numSets: 3,
          repsLower: 8,
          repsUpper: 12,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ]);
    const queryExercisesWhereDocumentIdIn = vi
      .fn()
      .mockResolvedValue([{ id: "e1", data: { displayName: "Squat" } }]);
    const port = stubPort({
      queryTemplatesWhereDayIdIn,
      queryExercisesWhereDocumentIdIn,
    });

    const map = await templatesWithNamesForDayIds(port, ["d1"]);

    expect(queryTemplatesWhereDayIdIn).toHaveBeenCalledWith(["d1"]);
    expect(queryExercisesWhereDocumentIdIn).toHaveBeenCalledWith(["e1"]);
    const rows = map.get("d1");
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.exerciseDisplayName).toBe("Squat");
  });
});

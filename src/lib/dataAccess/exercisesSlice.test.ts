import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStubFirestoreDataPort } from "../../test/stubFirestoreDataPort";
import {
  buildExercisesSlice,
  clearExerciseCatalogCache,
} from "./exercisesSlice";

describe("buildExercisesSlice", () => {
  beforeEach(() => {
    clearExerciseCatalogCache();
  });

  it("get returns null when the port has no document", async () => {
    const getDocument = vi.fn().mockResolvedValue(null);
    const slice = buildExercisesSlice(
      createStubFirestoreDataPort({ getDocument }),
      { start: vi.fn(), end: vi.fn() }
    );
    expect(await slice.get("missing")).toBeNull();
    expect(getDocument).toHaveBeenCalledWith("exercises", "missing");
  });

  it("listAllForSearch requests ascending catalog with capped limit", async () => {
    const queryExercisesList = vi.fn().mockResolvedValue([]);
    const slice = buildExercisesSlice(
      createStubFirestoreDataPort({ queryExercisesList }),
      { start: vi.fn(), end: vi.fn() }
    );

    await slice.listAllForSearch();

    expect(queryExercisesList).toHaveBeenCalledWith({
      sort: "asc",
      limit: 1000,
    });
  });

  it("listAllForSearch serves cache without a second query", async () => {
    const queryExercisesList = vi.fn().mockResolvedValue([
      {
        id: "ex-1",
        data: {
          nameLower: "squat",
          displayName: "Squat",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ]);
    const slice = buildExercisesSlice(
      createStubFirestoreDataPort({ queryExercisesList }),
      { start: vi.fn(), end: vi.fn() }
    );

    const first = await slice.listAllForSearch();
    const second = await slice.listAllForSearch();

    expect(queryExercisesList).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("listAllForSearch force refetches from Firestore", async () => {
    const queryExercisesList = vi.fn().mockResolvedValue([]);
    const slice = buildExercisesSlice(
      createStubFirestoreDataPort({ queryExercisesList }),
      { start: vi.fn(), end: vi.fn() }
    );

    await slice.listAllForSearch();
    await slice.listAllForSearch({ force: true });

    expect(queryExercisesList).toHaveBeenCalledTimes(2);
  });

  it("create patches cache so listAllForSearch does not refetch", async () => {
    const queryExercisesList = vi.fn().mockResolvedValue([]);
    const addDocument = vi.fn().mockResolvedValue("ex-new");
    const slice = buildExercisesSlice(
      createStubFirestoreDataPort({ queryExercisesList, addDocument }),
      { start: vi.fn(), end: vi.fn() }
    );

    await slice.listAllForSearch();
    await slice.create({ nameLower: "deadlift", displayName: "Deadlift" });
    const list = await slice.listAllForSearch();

    expect(queryExercisesList).toHaveBeenCalledTimes(1);
    expect(list.some((e) => e.id === "ex-new")).toBe(true);
  });

  it("delete removes exercise from cached catalog", async () => {
    const queryExercisesList = vi.fn().mockResolvedValue([
      {
        id: "ex-1",
        data: {
          nameLower: "squat",
          displayName: "Squat",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ]);
    const removeDocument = vi.fn().mockResolvedValue(undefined);
    const slice = buildExercisesSlice(
      createStubFirestoreDataPort({ queryExercisesList, removeDocument }),
      { start: vi.fn(), end: vi.fn() }
    );

    await slice.listAllForSearch();
    await slice.delete("ex-1");
    const list = await slice.listAllForSearch();

    expect(queryExercisesList).toHaveBeenCalledTimes(1);
    expect(list).toEqual([]);
  });
});

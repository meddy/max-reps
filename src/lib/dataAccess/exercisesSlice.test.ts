import { describe, expect, it, vi } from "vitest";
import { createStubFirestoreDataPort } from "../../test/stubFirestoreDataPort";
import { buildExercisesSlice } from "./exercisesSlice";

describe("buildExercisesSlice", () => {
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
});

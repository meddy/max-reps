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
});

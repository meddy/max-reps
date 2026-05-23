import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryFirestoreDataPort } from "./firestoreDataPort/inMemory";

/** Use the real module; `src/test/setup.ts` mocks it for other suites. */
vi.unmock("../lib/productionDataAccess");

vi.mock("./firebase", () => ({ db: {} }));

vi.mock("./firestoreDataPort/firebaseAdapter", () => ({
  createFirebaseFirestoreDataPort: vi.fn(() =>
    createInMemoryFirestoreDataPort()
  ),
}));

vi.mock("./savingStore", () => ({
  startSaving: vi.fn(),
  endSaving: vi.fn(),
}));

describe("getDefaultDataAccess", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a lazy singleton with the same surface as createDataAccess", async () => {
    const { getDefaultDataAccess } = await import("./productionDataAccess");
    const a = getDefaultDataAccess();
    expect(getDefaultDataAccess()).toBe(a);
    expect(a.workoutDetail).toMatchObject({
      loadWorkoutDetail: expect.any(Function),
      updateWorkout: expect.any(Function),
      lastPerformedGroupForExercise: expect.any(Function),
      deleteWorkoutWithSets: expect.any(Function),
    });
    expect(a.exercises.list).toEqual(expect.any(Function));
  });
});

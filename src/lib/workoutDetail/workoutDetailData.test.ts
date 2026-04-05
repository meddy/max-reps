import { describe, expect, it } from "vitest";
import { createTestDataAccess } from "../../test/mockDataAccess";
import { createWorkoutDetailDataHandlers } from "./workoutDetailData";

describe("createWorkoutDetailDataHandlers", () => {
  it("forwards deleteWorkoutWithSets to the session", async () => {
    const da = createTestDataAccess();
    const h = createWorkoutDetailDataHandlers(da.workoutSession, () => null);
    await h.deleteWorkoutWithSets("w1");
    expect(da.workouts.deleteWithSets).toHaveBeenCalledWith("w1");
  });

  it("forwards lastPerformedGroupForExercise to the session", async () => {
    const da = createTestDataAccess();
    const h = createWorkoutDetailDataHandlers(da.workoutSession, () => null);
    await h.lastPerformedGroupForExercise("e1", "w9");
    expect(da.sets.lastPerformedGroupForExercise).toHaveBeenCalledWith(
      "e1",
      "w9"
    );
  });
});

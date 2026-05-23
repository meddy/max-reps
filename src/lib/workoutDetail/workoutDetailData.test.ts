import { describe, expect, it } from "vitest";
import { createTestDataAccess } from "../../test/mockDataAccess";
import { createWorkoutDetailDataHandlers } from "./workoutDetailData";

describe("createWorkoutDetailDataHandlers", () => {
  it("forwards deleteWorkoutWithSets to workoutDetail", async () => {
    const da = createTestDataAccess();
    const h = createWorkoutDetailDataHandlers(da.workoutDetail, () => null);
    await h.deleteWorkoutWithSets("w1");
    expect(da.workouts.deleteWithSets).toHaveBeenCalledWith("w1");
  });

  it("forwards lastPerformedGroupForExercise to workoutDetail", async () => {
    const da = createTestDataAccess();
    const h = createWorkoutDetailDataHandlers(da.workoutDetail, () => null);
    await h.lastPerformedGroupForExercise("e1", "w9");
    expect(da.sets.lastPerformedGroupForExercise).toHaveBeenCalledWith(
      "e1",
      "w9"
    );
  });
});

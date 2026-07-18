import { describe, expect, it } from "vitest";
import {
  assertPlanWithinBatchLimit,
  FIRESTORE_BATCH_LIMIT,
  planExerciseSetReconcile,
} from "./planExerciseSetReconcile";

describe("planExerciseSetReconcile", () => {
  it("reuses existing ids, creates extras, deletes surplus", () => {
    const plan = planExerciseSetReconcile({
      desired: [
        { reps: 5, weight: 100, note: "" },
        { reps: 5, weight: 100, note: "" },
        { reps: 3, weight: 110, note: "pr" },
      ],
      existingForExercise: [
        { id: "s1", reps: 5, weight: 100, note: "", order: 0 },
        { id: "s2", reps: 5, weight: 95, note: "", order: 1 },
      ],
      allWorkoutSets: [
        { id: "s1", exerciseId: "e1", order: 0 },
        { id: "s2", exerciseId: "e1", order: 1 },
        { id: "s3", exerciseId: "e2", order: 2 },
      ],
      exerciseId: "e1",
      exerciseOrder: ["e1", "e2"],
    });

    expect(plan.updates).toHaveLength(2);
    expect(plan.creates).toHaveLength(1);
    expect(plan.deletes).toHaveLength(0);
    expect(plan.creates[0].order).toBe(2);
    expect(plan.otherOrderPatches).toEqual([{ id: "s3", order: 3 }]);
  });

  it("clears an exercise when desired is empty", () => {
    const plan = planExerciseSetReconcile({
      desired: [],
      existingForExercise: [
        { id: "s1", reps: 5, weight: 100, note: "", order: 0 },
      ],
      allWorkoutSets: [
        { id: "s1", exerciseId: "e1", order: 0 },
        { id: "s2", exerciseId: "e2", order: 1 },
      ],
      exerciseId: "e1",
      exerciseOrder: ["e2"],
    });
    expect(plan.deletes).toEqual([{ op: "delete", id: "s1" }]);
    expect(plan.otherOrderPatches).toEqual([{ id: "s2", order: 0 }]);
  });

  it("rejects plans over the batch limit", () => {
    expect(() =>
      assertPlanWithinBatchLimit({
        creates: [],
        updates: [],
        deletes: [],
        otherOrderPatches: [],
        operationCount: FIRESTORE_BATCH_LIMIT + 1,
      })
    ).toThrow(/batch limit/i);
  });
});

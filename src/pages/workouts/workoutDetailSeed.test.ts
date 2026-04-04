import { describe, expect, it } from "vitest";
import {
  rollupLastPerformedMap,
  toTemplateWithNameRows,
} from "./workoutDetailSeed";

describe("rollupLastPerformedMap", () => {
  it("keeps entries only when sets non-empty and workoutId present", () => {
    const map = rollupLastPerformedMap([
      ["e1", { sets: [{ reps: 5, weight: 100 }], workoutId: "w1" }],
      ["e2", { sets: [], workoutId: "w1" }],
      ["e3", { sets: [{ reps: 1, weight: 1 }] }],
    ]);
    expect(Object.keys(map)).toEqual(["e1"]);
    expect(map.e1).toEqual({
      sets: [{ reps: 5, weight: 100 }],
      workoutId: "w1",
    });
  });
});

describe("toTemplateWithNameRows", () => {
  it("copies exerciseDisplayName to exerciseName", () => {
    const ts = new Date();
    const rows = toTemplateWithNameRows([
      {
        id: "t1",
        dayId: "d1",
        exerciseId: "e1",
        numSets: 1,
        repsLower: 8,
        repsUpper: 12,
        order: 0,
        createdAt: ts,
        updatedAt: ts,
        exerciseDisplayName: "Squat",
      },
    ]);
    expect(rows[0].exerciseName).toBe("Squat");
    expect(rows[0].exerciseDisplayName).toBe("Squat");
  });
});

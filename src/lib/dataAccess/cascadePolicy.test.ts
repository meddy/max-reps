import { describe, expect, it } from "vitest";
import {
  cascadesForDayDelete,
  cascadesForWorkoutDelete,
} from "./cascadePolicy";

describe("cascadePolicy", () => {
  it("exports stable workout delete cascade shape", () => {
    expect(cascadesForWorkoutDelete).toEqual([
      { collection: "sets", field: "workoutId" },
    ]);
  });

  it("exports stable day delete cascade shape", () => {
    expect(cascadesForDayDelete).toEqual([
      { collection: "exerciseSetTemplates", field: "dayId" },
    ]);
  });
});

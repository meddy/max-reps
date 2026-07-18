import { describe, expect, it } from "vitest";
import type { WorkoutSet } from "../../types";
import {
  buildWorkoutCardModel,
  compareWorkoutsForSort,
  groupSetsIntoExerciseLines,
  workoutDisplayName,
} from "./workoutCardModel";

function set(
  partial: Partial<WorkoutSet> & Pick<WorkoutSet, "id" | "order" | "exerciseId">
): WorkoutSet {
  return {
    workoutId: "w1",
    exerciseNameSnapshot: partial.exerciseNameSnapshot ?? "Bench",
    reps: partial.reps ?? 5,
    weight: partial.weight ?? 100,
    unit: "lbs",
    note: partial.note ?? "",
    performedAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    ...partial,
  };
}

describe("workoutCardModel", () => {
  it("groups consecutive sets by exercise and formats entry text", () => {
    const lines = groupSetsIntoExerciseLines([
      set({ id: "1", exerciseId: "e1", order: 0, reps: 6, weight: 45 }),
      set({ id: "2", exerciseId: "e1", order: 1, reps: 7, weight: 45 }),
      set({
        id: "3",
        exerciseId: "e2",
        order: 2,
        reps: 9,
        weight: 0,
        exerciseNameSnapshot: "Pull-up",
        note: "new technique",
      }),
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0].entryText).toBe("45x6, 7");
    expect(lines[1].entryText).toBe("9 new technique");
  });

  it("uses Untitled workout placeholder for empty names", () => {
    expect(workoutDisplayName("")).toEqual({
      text: "Untitled workout",
      isPlaceholder: true,
    });
    expect(workoutDisplayName("Push")).toEqual({
      text: "Push",
      isPlaceholder: false,
    });
  });

  it("sorts by date then document id", () => {
    const date = new Date("2024-01-01");
    const a = {
      id: "a",
      date,
      dayId: "",
      dayNameSnapshot: "",
      createdAt: date,
      updatedAt: date,
    };
    const b = {
      id: "b",
      date,
      dayId: "",
      dayNameSnapshot: "",
      createdAt: date,
      updatedAt: date,
    };
    expect(compareWorkoutsForSort(a, b, "asc")).toBeLessThan(0);
    expect(compareWorkoutsForSort(a, b, "desc")).toBeGreaterThan(0);
  });

  it("buildWorkoutCardModel wires workout + exercises", () => {
    const date = new Date("2024-01-01");
    const model = buildWorkoutCardModel(
      {
        id: "w1",
        date,
        dayId: "d1",
        dayNameSnapshot: "Push",
        note: "pumped",
        createdAt: date,
        updatedAt: date,
      },
      [set({ id: "1", exerciseId: "e1", order: 0 })]
    );
    expect(model.workout.dayNameSnapshot).toBe("Push");
    expect(model.exercises).toHaveLength(1);
  });
});

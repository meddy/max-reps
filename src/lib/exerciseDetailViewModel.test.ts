import { describe, expect, it } from "vitest";
import type { WorkoutSet } from "../types";
import {
  buildSetNumberBySetId,
  buildSortedSetsForHistory,
  buildTopSetsPerWorkoutChartSeries,
} from "./exerciseDetailViewModel";

function set(
  partial: Partial<WorkoutSet> & { id: string; workoutId: string }
): WorkoutSet & { id: string } {
  const d = new Date("2024-06-15T12:00:00Z");
  return {
    exerciseId: "e1",
    exerciseNameSnapshot: "Lift",
    reps: 5,
    weight: 100,
    unit: "lbs",
    note: "",
    performedAt: d,
    order: 0,
    createdAt: d,
    ...partial,
  };
}

describe("exerciseDetailViewModel", () => {
  it("buildSetNumberBySetId orders by order within workout", () => {
    const s1 = set({
      id: "a",
      workoutId: "w1",
      order: 2,
    });
    const s2 = set({
      id: "b",
      workoutId: "w1",
      order: 1,
    });
    const map = buildSetNumberBySetId([s1, s2]);
    expect(map.get("b")).toBe(1);
    expect(map.get("a")).toBe(2);
  });

  it("buildSortedSetsForHistory sorts by performedAt desc then set number", () => {
    const early = set({
      id: "early",
      workoutId: "w1",
      performedAt: new Date("2024-01-01"),
      order: 0,
    });
    const late = set({
      id: "late",
      workoutId: "w2",
      performedAt: new Date("2024-06-01"),
      order: 0,
    });
    const map = buildSetNumberBySetId([early, late]);
    const sorted = buildSortedSetsForHistory([early, late], map);
    expect(sorted.map((x) => x.id)).toEqual(["late", "early"]);
  });

  it("buildTopSetsPerWorkoutChartSeries picks best set per workout and sorts by date", () => {
    const w1light = set({
      id: "w1a",
      workoutId: "w1",
      weight: 100,
      reps: 5,
      performedAt: new Date("2024-01-01"),
    });
    const w1heavy = set({
      id: "w1b",
      workoutId: "w1",
      weight: 120,
      reps: 3,
      performedAt: new Date("2024-01-02"),
    });
    const w2 = set({
      id: "w2a",
      workoutId: "w2",
      weight: 90,
      reps: 8,
      performedAt: new Date("2024-03-01"),
    });
    const series = buildTopSetsPerWorkoutChartSeries([w1light, w1heavy, w2]);
    expect(series).toHaveLength(2);
    expect(series[0].weight).toBe(120);
    expect(series[1].weight).toBe(90);
  });
});

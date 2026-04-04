import { describe, expect, it } from "vitest";
import {
  mapDayFromDoc,
  mapExerciseFromDoc,
  mapTemplateFromDoc,
  mapWorkoutFromDoc,
  mapWorkoutSetFromDoc,
} from "./firestoreModelMappers";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe("mapExerciseFromDoc", () => {
  it("maps fields", () => {
    const created = d(2024, 1, 1);
    const updated = d(2024, 2, 1);
    const row = mapExerciseFromDoc("ex1", {
      nameLower: "bench",
      displayName: "Bench",
      createdAt: created,
      updatedAt: updated,
    });
    expect(row).toEqual({
      id: "ex1",
      nameLower: "bench",
      displayName: "Bench",
      createdAt: created,
      updatedAt: updated,
    });
  });
});

describe("mapDayFromDoc", () => {
  it("maps fields", () => {
    const created = d(2024, 3, 1);
    const updated = d(2024, 3, 2);
    expect(
      mapDayFromDoc("d1", {
        nameLower: "leg",
        displayName: "Leg day",
        createdAt: created,
        updatedAt: updated,
      })
    ).toMatchObject({
      id: "d1",
      nameLower: "leg",
      displayName: "Leg day",
    });
  });
});

describe("mapTemplateFromDoc", () => {
  it("maps fields", () => {
    const created = d(2024, 4, 1);
    const updated = d(2024, 4, 2);
    const row = mapTemplateFromDoc("t1", {
      dayId: "d1",
      exerciseId: "e1",
      numSets: 3,
      repsLower: 8,
      repsUpper: 12,
      order: 0,
      createdAt: created,
      updatedAt: updated,
    });
    expect(row).toMatchObject({
      id: "t1",
      dayId: "d1",
      exerciseId: "e1",
      numSets: 3,
      repsLower: 8,
      repsUpper: 12,
      order: 0,
    });
  });
});

describe("mapWorkoutFromDoc", () => {
  it("maps fields and optional note", () => {
    const date = d(2024, 5, 10);
    const created = d(2024, 5, 9);
    const updated = d(2024, 5, 10);
    expect(
      mapWorkoutFromDoc("w1", {
        date,
        dayId: "d1",
        dayNameSnapshot: "Push",
        note: "felt good",
        createdAt: created,
        updatedAt: updated,
      })
    ).toMatchObject({
      id: "w1",
      dayId: "d1",
      dayNameSnapshot: "Push",
      note: "felt good",
    });

    expect(
      mapWorkoutFromDoc("w2", {
        date,
        dayId: "d1",
        dayNameSnapshot: "Push",
        createdAt: created,
        updatedAt: updated,
      }).note
    ).toBeUndefined();
  });
});

describe("mapWorkoutSetFromDoc", () => {
  it("maps fields and defaults empty note to string", () => {
    const performed = d(2024, 6, 1);
    const created = d(2024, 6, 1);
    expect(
      mapWorkoutSetFromDoc("s1", {
        workoutId: "w1",
        exerciseId: "e1",
        exerciseNameSnapshot: "Squat",
        reps: 5,
        weight: 225,
        unit: "lbs",
        performedAt: performed,
        order: 0,
        createdAt: created,
      })
    ).toMatchObject({
      id: "s1",
      reps: 5,
      weight: 225,
      note: "",
    });

    expect(
      mapWorkoutSetFromDoc("s2", {
        workoutId: "w1",
        exerciseId: "e1",
        exerciseNameSnapshot: "Squat",
        reps: 5,
        weight: 225,
        unit: "lbs",
        note: "paused",
        performedAt: performed,
        order: 0,
        createdAt: created,
      }).note
    ).toBe("paused");
  });
});

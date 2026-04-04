import { describe, expect, it, vi } from "vitest";
import {
  cascadesForDayDelete,
  cascadesForWorkoutDelete,
} from "../dataAccess/cascadePolicy";
import { buildDaysSlice } from "../dataAccess/daysSlice";
import { buildWorkoutsSlice } from "../dataAccess/workoutsSlice";
import { createInMemoryFirestoreDataPort } from "./inMemory";

describe("createInMemoryFirestoreDataPort removeDocumentAndRelated", () => {
  it("deletes cascaded child documents then the parent", async () => {
    const port = createInMemoryFirestoreDataPort({
      days: {
        day1: { nameLower: "push", displayName: "Push" },
      },
      exerciseSetTemplates: {
        t1: { dayId: "day1", exerciseId: "e1", order: 0 },
        t2: { dayId: "day1", exerciseId: "e2", order: 1 },
      },
    });

    await port.removeDocumentAndRelated("days", "day1", cascadesForDayDelete);

    expect(await port.getDocument("days", "day1")).toBeNull();
    expect(await port.getDocument("exerciseSetTemplates", "t1")).toBeNull();
    expect(await port.getDocument("exerciseSetTemplates", "t2")).toBeNull();
  });

  it("deletes sets then workout when using workout delete cascades", async () => {
    const port = createInMemoryFirestoreDataPort({
      workouts: {
        w1: {
          date: new Date("2024-01-01"),
          dayId: "d1",
          dayNameSnapshot: "Push",
          note: "",
        },
      },
      sets: {
        s1: {
          workoutId: "w1",
          exerciseId: "e1",
          reps: 5,
          weight: 100,
          performedAt: new Date("2024-01-01"),
          unit: "lbs",
          note: "",
        },
        s2: {
          workoutId: "w1",
          exerciseId: "e2",
          reps: 5,
          weight: 100,
          performedAt: new Date("2024-01-01"),
          unit: "lbs",
          note: "",
        },
      },
    });

    await port.removeDocumentAndRelated(
      "workouts",
      "w1",
      cascadesForWorkoutDelete
    );

    expect(await port.getDocument("workouts", "w1")).toBeNull();
    expect(await port.getDocument("sets", "s1")).toBeNull();
    expect(await port.getDocument("sets", "s2")).toBeNull();
  });
});

describe("slice delete uses cascadePolicy with FirestoreDataPort", () => {
  const saving = { start: vi.fn(), end: vi.fn() };

  it("deleteWithSets passes cascadesForWorkoutDelete", async () => {
    const port = createInMemoryFirestoreDataPort({
      workouts: {
        w1: { date: new Date(), dayId: "d1", dayNameSnapshot: "X", note: "" },
      },
      sets: {
        s1: {
          workoutId: "w1",
          exerciseId: "e1",
          reps: 1,
          weight: 1,
          performedAt: new Date(),
          unit: "lbs",
          note: "",
        },
      },
    });
    const spy = vi.spyOn(port, "removeDocumentAndRelated");

    await buildWorkoutsSlice(port, saving).deleteWithSets("w1");

    expect(spy).toHaveBeenCalledWith(
      "workouts",
      "w1",
      cascadesForWorkoutDelete
    );
  });

  it("deleteWithTemplates passes cascadesForDayDelete", async () => {
    const port = createInMemoryFirestoreDataPort({
      days: { day1: { nameLower: "a", displayName: "A" } },
    });
    const spy = vi.spyOn(port, "removeDocumentAndRelated");

    await buildDaysSlice(port, saving).deleteWithTemplates("day1");

    expect(spy).toHaveBeenCalledWith("days", "day1", cascadesForDayDelete);
  });
});

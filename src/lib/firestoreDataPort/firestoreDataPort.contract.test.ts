import { describe, expect, it } from "vitest";
import {
  cascadesForDayDelete,
  cascadesForWorkoutDelete,
} from "../dataAccess/cascadePolicy";
import { createInMemoryFirestoreDataPort } from "./inMemory";

/**
 * Table-driven scenarios for FirestoreDataPort behavior exercised via the
 * in-memory implementation. Extend here when port semantics change; production
 * paths are covered by adapter + slice tests.
 */
describe("FirestoreDataPort contract (in-memory)", () => {
  describe.each([
    {
      label: "day delete cascades templates by dayId",
      seed: {
        days: {
          day1: { nameLower: "push", displayName: "Push" },
        },
        exerciseSetTemplates: {
          t1: { dayId: "day1", exerciseId: "e1", order: 0 },
          t2: { dayId: "day1", exerciseId: "e2", order: 1 },
        },
      } as const,
      parent: "days" as const,
      parentId: "day1",
      cascades: cascadesForDayDelete,
      expectMissing: [
        { collection: "days" as const, id: "day1" },
        { collection: "exerciseSetTemplates" as const, id: "t1" },
        { collection: "exerciseSetTemplates" as const, id: "t2" },
      ],
    },
    {
      label: "workout delete cascades sets by workoutId",
      seed: {
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
        },
      } as const,
      parent: "workouts" as const,
      parentId: "w1",
      cascades: cascadesForWorkoutDelete,
      expectMissing: [
        { collection: "workouts" as const, id: "w1" },
        { collection: "sets" as const, id: "s1" },
      ],
    },
  ])(
    "removeDocumentAndRelated: $label",
    ({ seed, parent, parentId, cascades, expectMissing }) => {
      it("deletes parent and cascaded children", async () => {
        const port = createInMemoryFirestoreDataPort(seed);
        await port.removeDocumentAndRelated(parent, parentId, cascades);

        for (const { collection, id } of expectMissing) {
          expect(await port.getDocument(collection, id)).toBeNull();
        }
      });
    }
  );

  it("addDocument, patchDocument, removeDocument round-trip", async () => {
    const port = createInMemoryFirestoreDataPort();
    const id = await port.addDocument("exercises", {
      nameLower: "bench",
      displayName: "Bench",
    });
    expect(id.length).toBeGreaterThan(0);
    const got = await port.getDocument("exercises", id);
    expect(got?.data.displayName).toBe("Bench");

    await port.patchDocument("exercises", id, { displayName: "Bench Press" });
    const patched = await port.getDocument("exercises", id);
    expect(patched?.data.displayName).toBe("Bench Press");

    await port.removeDocument("exercises", id);
    expect(await port.getDocument("exercises", id)).toBeNull();
  });

  describe.each([
    {
      sort: "asc" as const,
      want: ["w_early", "w_late"],
    },
    {
      sort: "desc" as const,
      want: ["w_late", "w_early"],
    },
  ])("queryWorkoutsByDate ($sort)", ({ sort, want }) => {
    it("orders by workout date", async () => {
      const port = createInMemoryFirestoreDataPort({
        workouts: {
          w_late: {
            date: new Date("2024-06-01"),
            dayId: "d1",
            dayNameSnapshot: "Late",
            note: "",
          },
          w_early: {
            date: new Date("2024-01-01"),
            dayId: "d1",
            dayNameSnapshot: "Early",
            note: "",
          },
        },
      });
      const rows = await port.queryWorkoutsByDate({ sort, limit: 10 });
      expect(rows.map((r) => r.id)).toEqual(want);
    });
  });

  describe.each([
    {
      sort: "asc" as const,
      want: ["d_a", "d_b"],
    },
    {
      sort: "desc" as const,
      want: ["d_b", "d_a"],
    },
  ])("queryDaysList ($sort)", ({ sort, want }) => {
    it("orders by nameLower", async () => {
      const port = createInMemoryFirestoreDataPort({
        days: {
          d_a: { nameLower: "alpha", displayName: "Alpha" },
          d_b: { nameLower: "beta", displayName: "Beta" },
        },
      });
      const rows = await port.queryDaysList({ sort, limit: 10 });
      expect(rows.map((r) => r.id)).toEqual(want);
    });
  });
});

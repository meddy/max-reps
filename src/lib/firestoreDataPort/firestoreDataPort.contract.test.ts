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

  it("syncWorkoutDateAndSetsPerformedAt updates workout date and all sets performedAt", async () => {
    const d0 = new Date("2024-01-01");
    const d1 = new Date("2024-06-15");
    const port = createInMemoryFirestoreDataPort({
      workouts: {
        w1: {
          date: d0,
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
          performedAt: d0,
          unit: "lbs",
          note: "",
          order: 0,
        },
        s2: {
          workoutId: "w1",
          exerciseId: "e1",
          reps: 3,
          weight: 90,
          performedAt: d0,
          unit: "lbs",
          note: "",
          order: 1,
        },
      },
    });
    await port.syncWorkoutDateAndSetsPerformedAt("w1", d1);
    const w = await port.getDocument("workouts", "w1");
    expect(w?.data.date).toEqual(d1);
    expect(w?.data.updatedAt).toBeInstanceOf(Date);
    const s1 = await port.getDocument("sets", "s1");
    const s2 = await port.getDocument("sets", "s2");
    expect(s1?.data.performedAt).toEqual(d1);
    expect(s2?.data.performedAt).toEqual(d1);
  });

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

  it("patchDocuments applies multiple document updates", async () => {
    const port = createInMemoryFirestoreDataPort({
      exerciseSetTemplates: {
        t1: { dayId: "d1", exerciseId: "e1", order: 0 },
        t2: { dayId: "d1", exerciseId: "e2", order: 1 },
      },
    });

    await port.patchDocuments([
      {
        collectionName: "exerciseSetTemplates",
        id: "t1",
        data: { order: 1 },
      },
      {
        collectionName: "exerciseSetTemplates",
        id: "t2",
        data: { order: 0 },
      },
    ]);

    const t1 = await port.getDocument("exerciseSetTemplates", "t1");
    const t2 = await port.getDocument("exerciseSetTemplates", "t2");
    expect(t1?.data.order).toBe(1);
    expect(t2?.data.order).toBe(0);
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

  it("queryWorkoutsByDate paginates with startAfter", async () => {
    const sameDate = new Date("2024-03-15T12:00:00");
    const port = createInMemoryFirestoreDataPort({
      workouts: {
        w_a: {
          date: sameDate,
          dayId: "d1",
          dayNameSnapshot: "A",
          note: "",
        },
        w_b: {
          date: sameDate,
          dayId: "d1",
          dayNameSnapshot: "B",
          note: "",
        },
        w_c: {
          date: new Date("2024-01-01"),
          dayId: "d1",
          dayNameSnapshot: "C",
          note: "",
        },
      },
    });
    const page1 = await port.queryWorkoutsByDate({ sort: "desc", limit: 1 });
    expect(page1).toHaveLength(1);
    const page2 = await port.queryWorkoutsByDate({
      sort: "desc",
      limit: 10,
      startAfter: {
        date: new Date(page1[0]!.data.date as Date),
        id: page1[0]!.id,
      },
    });
    expect(page2.map((r) => r.id)).not.toContain(page1[0]!.id);
    expect(page2.length).toBeGreaterThan(0);
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

  it("queryDaysWhereDocumentIdIn returns matching day docs", async () => {
    const port = createInMemoryFirestoreDataPort({
      days: {
        d1: { nameLower: "push", displayName: "Push" },
        d2: { nameLower: "pull", displayName: "Pull" },
      },
    });
    const rows = await port.queryDaysWhereDocumentIdIn(["d2", "missing"]);
    expect(rows.map((r) => r.id)).toEqual(["d2"]);
  });

  it("querySetsWhereWorkoutIdIn returns sets for multiple workouts", async () => {
    const port = createInMemoryFirestoreDataPort({
      sets: {
        s1: {
          workoutId: "w1",
          exerciseId: "e1",
          reps: 5,
          weight: 100,
          order: 0,
          unit: "lbs",
          note: "",
          performedAt: new Date("2024-01-01"),
        },
        s2: {
          workoutId: "w2",
          exerciseId: "e1",
          reps: 8,
          weight: 0,
          order: 0,
          unit: "lbs",
          note: "",
          performedAt: new Date("2024-01-02"),
        },
        s3: {
          workoutId: "w3",
          exerciseId: "e2",
          reps: 3,
          weight: 50,
          order: 0,
          unit: "lbs",
          note: "",
          performedAt: new Date("2024-01-03"),
        },
      },
    });
    const rows = await port.querySetsWhereWorkoutIdIn(["w1", "w2"]);
    expect(rows.map((r) => r.id).sort()).toEqual(["s1", "s2"]);
  });

  it("reconcileExerciseSets creates updates and deletes atomically", async () => {
    const port = createInMemoryFirestoreDataPort({
      sets: {
        s1: {
          workoutId: "w1",
          exerciseId: "e1",
          exerciseNameSnapshot: "Bench",
          reps: 5,
          weight: 100,
          order: 0,
          unit: "lbs",
          note: "",
          performedAt: new Date("2024-01-01"),
        },
        s2: {
          workoutId: "w1",
          exerciseId: "e2",
          exerciseNameSnapshot: "Row",
          reps: 8,
          weight: 60,
          order: 1,
          unit: "lbs",
          note: "",
          performedAt: new Date("2024-01-01"),
        },
      },
    });

    const result = await port.reconcileExerciseSets({
      workoutId: "w1",
      exerciseId: "e1",
      exerciseNameSnapshot: "Bench",
      performedAt: new Date("2024-01-01"),
      desiredSets: [
        { reps: 5, weight: 105, note: "" },
        { reps: 5, weight: 105, note: "solid" },
      ],
      currentSets: [
        {
          id: "s1",
          exerciseId: "e1",
          reps: 5,
          weight: 100,
          note: "",
          order: 0,
        },
        {
          id: "s2",
          exerciseId: "e2",
          reps: 8,
          weight: 60,
          note: "",
          order: 1,
        },
      ],
      exerciseOrder: ["e1", "e2"],
    });

    expect(result.createdIds).toHaveLength(1);
    const s1 = await port.getDocument("sets", "s1");
    expect(s1?.data.weight).toBe(105);
    expect(s1?.data.order).toBe(0);
    const created = await port.getDocument("sets", result.createdIds[0]!);
    expect(created?.data.reps).toBe(5);
    expect(created?.data.note).toBe("solid");
    expect(created?.data.order).toBe(1);
    const s2 = await port.getDocument("sets", "s2");
    expect(s2?.data.order).toBe(2);
  });

  it("copyWorkoutWithSets creates workout and sets without notes", async () => {
    const port = createInMemoryFirestoreDataPort();
    const date = new Date("2024-07-01T12:00:00");
    const result = await port.copyWorkoutWithSets({
      workout: {
        date,
        dayId: "d1",
        dayNameSnapshot: "Push",
        note: "",
      },
      sets: [
        {
          exerciseId: "e1",
          exerciseNameSnapshot: "Bench",
          reps: 5,
          weight: 100,
          order: 0,
        },
      ],
    });
    const workout = await port.getDocument("workouts", result.workoutId);
    expect(workout?.data.dayNameSnapshot).toBe("Push");
    expect(workout?.data.note).toBe("");
    expect(result.setIds).toHaveLength(1);
    const set = await port.getDocument("sets", result.setIds[0]!);
    expect(set?.data.workoutId).toBe(result.workoutId);
    expect(set?.data.note).toBe("");
    expect(set?.data.performedAt).toEqual(date);
  });
});

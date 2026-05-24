import { describe, expect, it, vi } from "vitest";
import { createInMemoryFirestoreDataPort } from "../firestoreDataPort/inMemory";
import { buildSetsSlice } from "./setsSlice";

describe("buildSetsSlice", () => {
  it("listForWorkout returns sets ordered by order field", async () => {
    const ts = new Date("2024-03-01T12:00:00.000Z");
    const firestore = createInMemoryFirestoreDataPort({
      sets: {
        s2: {
          workoutId: "w1",
          exerciseId: "e1",
          exerciseNameSnapshot: "A",
          reps: 1,
          weight: 1,
          unit: "lbs",
          note: "",
          performedAt: ts,
          order: 1,
          createdAt: ts,
        },
        s1: {
          workoutId: "w1",
          exerciseId: "e1",
          exerciseNameSnapshot: "A",
          reps: 2,
          weight: 2,
          unit: "lbs",
          note: "",
          performedAt: ts,
          order: 0,
          createdAt: ts,
        },
      },
    });
    const slice = buildSetsSlice(firestore, { start: vi.fn(), end: vi.fn() });
    const list = await slice.listForWorkout("w1");
    expect(list.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("create writes a set row the port can read back", async () => {
    const firestore = createInMemoryFirestoreDataPort();
    const slice = buildSetsSlice(firestore, { start: vi.fn(), end: vi.fn() });
    const ts = new Date("2024-04-01T12:00:00.000Z");
    await slice.create({
      workoutId: "w1",
      exerciseId: "e1",
      exerciseNameSnapshot: "Bench",
      reps: 5,
      weight: 135,
      unit: "lbs",
      note: "",
      performedAt: ts,
      order: 0,
    });
    const list = await slice.listForWorkout("w1");
    expect(list).toHaveLength(1);
    expect(list[0].reps).toBe(5);
    expect(list[0].exerciseNameSnapshot).toBe("Bench");
  });

  it("reorder batch-updates set order values", async () => {
    const ts = new Date("2024-03-01T12:00:00.000Z");
    const firestore = createInMemoryFirestoreDataPort({
      sets: {
        s1: {
          workoutId: "w1",
          exerciseId: "e1",
          exerciseNameSnapshot: "A",
          reps: 2,
          weight: 2,
          unit: "lbs",
          note: "",
          performedAt: ts,
          order: 0,
          createdAt: ts,
        },
        s2: {
          workoutId: "w1",
          exerciseId: "e2",
          exerciseNameSnapshot: "B",
          reps: 1,
          weight: 1,
          unit: "lbs",
          note: "",
          performedAt: ts,
          order: 1,
          createdAt: ts,
        },
      },
    });
    const patchDocumentsSpy = vi.spyOn(firestore, "patchDocuments");
    const slice = buildSetsSlice(firestore, { start: vi.fn(), end: vi.fn() });

    await slice.reorder([
      { id: "s1", order: 1 },
      { id: "s2", order: 0 },
    ]);

    expect(patchDocumentsSpy).toHaveBeenCalledWith([
      { collectionName: "sets", id: "s1", data: { order: 1 } },
      { collectionName: "sets", id: "s2", data: { order: 0 } },
    ]);
    const list = await slice.listForWorkout("w1");
    expect(list.map((s) => s.id)).toEqual(["s2", "s1"]);
  });

  it("lastPerformedGroupForExercise loads sets from prior Workout via two-step query", async () => {
    const older = new Date("2024-01-01T12:00:00.000Z");
    const newer = new Date("2024-02-01T12:00:00.000Z");
    const firestore = createInMemoryFirestoreDataPort({
      sets: {
        s1: {
          workoutId: "w-current",
          exerciseId: "e-bench",
          exerciseNameSnapshot: "Bench",
          reps: 5,
          weight: 225,
          unit: "lbs",
          note: "",
          performedAt: newer,
          order: 0,
          createdAt: newer,
        },
        s2: {
          workoutId: "w-old",
          exerciseId: "e-bench",
          exerciseNameSnapshot: "Bench",
          reps: 8,
          weight: 185,
          unit: "lbs",
          note: "deep",
          performedAt: older,
          order: 0,
          createdAt: older,
        },
        s3: {
          workoutId: "w-old",
          exerciseId: "e-bench",
          exerciseNameSnapshot: "Bench",
          reps: 6,
          weight: 185,
          unit: "lbs",
          note: "",
          performedAt: older,
          order: 1,
          createdAt: older,
        },
        s4: {
          workoutId: "w-old",
          exerciseId: "e-squat",
          exerciseNameSnapshot: "Squat",
          reps: 5,
          weight: 315,
          unit: "lbs",
          note: "",
          performedAt: older,
          order: 0,
          createdAt: older,
        },
      },
    });
    const slice = buildSetsSlice(firestore, { start: vi.fn(), end: vi.fn() });

    const out = await slice.lastPerformedGroupForExercise(
      "e-bench",
      "w-current"
    );

    expect(out.workoutId).toBe("w-old");
    expect(out.sets).toEqual([
      { reps: 8, weight: 185, note: "deep" },
      { reps: 6, weight: 185, note: "" },
    ]);
  });

  it("lastPerformedGroupForExercise returns empty when scan finds only excluded Workout", async () => {
    const ts = new Date("2024-02-01T12:00:00.000Z");
    const firestore = createInMemoryFirestoreDataPort({
      sets: {
        s1: {
          workoutId: "w-current",
          exerciseId: "e-bench",
          exerciseNameSnapshot: "Bench",
          reps: 5,
          weight: 225,
          unit: "lbs",
          note: "",
          performedAt: ts,
          order: 0,
          createdAt: ts,
        },
      },
    });
    const slice = buildSetsSlice(firestore, { start: vi.fn(), end: vi.fn() });

    const out = await slice.lastPerformedGroupForExercise(
      "e-bench",
      "w-current"
    );

    expect(out).toEqual({ sets: [] });
  });
});

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
});

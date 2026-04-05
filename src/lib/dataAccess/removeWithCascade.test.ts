import { describe, expect, it } from "vitest";
import { createInMemoryFirestoreDataPort } from "../firestoreDataPort/inMemory";
import { removeWithCascade } from "./removeWithCascade";

describe("removeWithCascade", () => {
  it.each([
    {
      label: "day delete cascades templates",
      key: "day" as const,
      id: "day1",
      seed: {
        days: {
          day1: { nameLower: "push", displayName: "Push" },
        },
        exerciseSetTemplates: {
          t1: { dayId: "day1", exerciseId: "e1", order: 0 },
        },
      },
      expectMissing: [
        { collection: "days" as const, id: "day1" },
        { collection: "exerciseSetTemplates" as const, id: "t1" },
      ],
    },
    {
      label: "workout delete cascades sets",
      key: "workout" as const,
      id: "w1",
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
      },
      expectMissing: [
        { collection: "workouts" as const, id: "w1" },
        { collection: "sets" as const, id: "s1" },
      ],
    },
  ])("$label", async ({ key, id, seed, expectMissing }) => {
    const port = createInMemoryFirestoreDataPort(seed);
    await removeWithCascade(port, key, id);
    for (const { collection, id: docId } of expectMissing) {
      expect(await port.getDocument(collection, docId)).toBeNull();
    }
  });
});

import { describe, expect, it, vi } from "vitest";
import { createStubFirestoreDataPort } from "../../test/stubFirestoreDataPort";
import { createInMemoryFirestoreDataPort } from "../firestoreDataPort/inMemory";
import { buildWorkoutsSlice } from "./workoutsSlice";

describe("buildWorkoutsSlice", () => {
  describe("update", () => {
    it("uses syncWorkoutDateAndSetsPerformedAt when patch includes date", async () => {
      const d0 = new Date("2024-01-01T12:00:00.000Z");
      const d1 = new Date("2024-06-15T12:00:00.000Z");
      const firestore = createInMemoryFirestoreDataPort({
        workouts: {
          w1: {
            date: d0,
            dayId: "d1",
            dayNameSnapshot: "Push",
            note: "n",
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
            exerciseNameSnapshot: "Bench",
          },
        },
      });
      const saving = { start: vi.fn(), end: vi.fn() };
      const slice = buildWorkoutsSlice(firestore, saving);
      await slice.update("w1", { date: d1 });

      const w = await firestore.getDocument("workouts", "w1");
      expect(w?.data.date).toEqual(d1);
      expect(w?.data.updatedAt).toBeInstanceOf(Date);
      const s1 = await firestore.getDocument("sets", "s1");
      expect(s1?.data.performedAt).toEqual(d1);
    });

    it("patches non-date fields without calling sync", async () => {
      const sync = vi.fn().mockResolvedValue(undefined);
      const patch = vi.fn().mockResolvedValue(undefined);
      const firestore = createStubFirestoreDataPort({
        syncWorkoutDateAndSetsPerformedAt: sync,
        patchDocument: patch,
      });
      const slice = buildWorkoutsSlice(firestore, {
        start: vi.fn(),
        end: vi.fn(),
      });

      await slice.update("w1", { note: "new" });

      expect(sync).not.toHaveBeenCalled();
      expect(patch).toHaveBeenCalledWith("workouts", "w1", { note: "new" });
    });

    it("runs sync then patch when date and other fields change", async () => {
      const d0 = new Date("2024-01-01T12:00:00.000Z");
      const d1 = new Date("2024-06-15T12:00:00.000Z");
      const firestore = createInMemoryFirestoreDataPort({
        workouts: {
          w1: {
            date: d0,
            dayId: "d1",
            dayNameSnapshot: "Push",
            note: "a",
          },
        },
      });
      const slice = buildWorkoutsSlice(firestore, {
        start: vi.fn(),
        end: vi.fn(),
      });
      await slice.update("w1", { date: d1, note: "b" });

      const w = await firestore.getDocument("workouts", "w1");
      expect(w?.data.date).toEqual(d1);
      expect(w?.data.note).toBe("b");
    });
  });

  describe("attachSetStats", () => {
    it("aggregates set counts and volume per workout via batched reads", async () => {
      const d = new Date("2024-01-01T12:00:00.000Z");
      const firestore = createInMemoryFirestoreDataPort({
        workouts: {
          w1: {
            date: d,
            dayId: "d1",
            dayNameSnapshot: "Push",
            note: "",
          },
          w2: {
            date: d,
            dayId: "d1",
            dayNameSnapshot: "Pull",
            note: "",
          },
        },
        sets: {
          s1: {
            workoutId: "w1",
            exerciseId: "e1",
            reps: 5,
            weight: 100,
            performedAt: d,
            unit: "lbs",
            note: "",
            order: 0,
            exerciseNameSnapshot: "Bench",
          },
          s2: {
            workoutId: "w1",
            exerciseId: "e2",
            reps: 10,
            weight: 50,
            performedAt: d,
            unit: "lbs",
            note: "",
            order: 1,
            exerciseNameSnapshot: "Row",
          },
          s3: {
            workoutId: "w2",
            exerciseId: "e1",
            reps: 3,
            weight: 200,
            performedAt: d,
            unit: "lbs",
            note: "",
            order: 0,
            exerciseNameSnapshot: "Bench",
          },
        },
      });
      const slice = buildWorkoutsSlice(firestore, {
        start: vi.fn(),
        end: vi.fn(),
      });
      const workouts = await slice.listRecent({ sort: "desc", limit: 10 });
      const withStats = await slice.attachSetStats(workouts);

      const w1 = withStats.find((w) => w.id === "w1");
      const w2 = withStats.find((w) => w.id === "w2");
      expect(w1?.setCount).toBe(2);
      expect(w1?.exerciseCount).toBe(2);
      expect(w1?.totalLoad).toBe(5 * 100 + 10 * 50);
      expect(w2?.setCount).toBe(1);
      expect(w2?.exerciseCount).toBe(1);
      expect(w2?.totalLoad).toBe(600);
    });
  });
});

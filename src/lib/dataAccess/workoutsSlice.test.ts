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
});

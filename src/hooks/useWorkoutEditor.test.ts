import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Workout } from "../types";
import {
  editorGroupsFromWorkoutSets,
  useWorkoutEditor,
} from "./useWorkoutEditor";

const ts = new Date("2024-06-01T12:00:00");

const fakeWorkout: Workout = {
  id: "w1",
  date: ts,
  dayId: "d1",
  dayNameSnapshot: "Push",
  note: "",
  createdAt: ts,
  updatedAt: ts,
};

describe("editorGroupsFromWorkoutSets", () => {
  it("groups rows by exercise in encounter order", () => {
    const sets = [
      {
        id: "s1",
        workoutId: "w1",
        exerciseId: "e1",
        exerciseNameSnapshot: "Bench",
        reps: 5,
        weight: 185,
        unit: "lbs",
        note: "",
        performedAt: ts,
        order: 0,
        createdAt: ts,
      },
      {
        id: "s2",
        workoutId: "w1",
        exerciseId: "e1",
        exerciseNameSnapshot: "Bench",
        reps: 5,
        weight: 185,
        unit: "lbs",
        note: "",
        performedAt: ts,
        order: 1,
        createdAt: ts,
      },
      {
        id: "s3",
        workoutId: "w1",
        exerciseId: "e2",
        exerciseNameSnapshot: "Row",
        reps: 8,
        weight: 135,
        unit: "lbs",
        note: "",
        performedAt: ts,
        order: 2,
        createdAt: ts,
      },
    ];
    const groups = editorGroupsFromWorkoutSets(sets);
    expect(groups).toHaveLength(2);
    expect(groups[0].exerciseId).toBe("e1");
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[1].exerciseId).toBe("e2");
    expect(groups[1].rows).toHaveLength(1);
  });
});

describe("useWorkoutEditor", () => {
  it("persists a new set after flush when reps are positive", async () => {
    const persistence = {
      saveSet: vi.fn().mockResolvedValue("new-id"),
      updateSet: vi.fn().mockResolvedValue(undefined),
      deleteSet: vi.fn().mockResolvedValue(undefined),
    };

    const { result } = renderHook(() =>
      useWorkoutEditor({
        variant: "workout",
        workoutId: "w1",
        workout: fakeWorkout,
        initialGroups: [],
        resetKey: "rk1",
        persistence,
        debounceMs: 0,
      })
    );

    act(() => {
      result.current.addExercise("e1", "Squat");
    });

    const rowId = result.current.groups[0].rows[0].id;

    await act(async () => {
      result.current.getRowApi(rowId).setField("reps", 8);
    });
    await act(async () => {
      await result.current.getRowApi(rowId).flush();
    });

    expect(persistence.saveSet).toHaveBeenCalledOnce();
    expect(persistence.saveSet).toHaveBeenCalledWith(
      expect.objectContaining({
        workoutId: "w1",
        exerciseId: "e1",
        exerciseNameSnapshot: "Squat",
      })
    );
  });
});

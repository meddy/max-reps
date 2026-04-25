import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Workout } from "../../types";
import { createWorkoutSessionStore } from "./createWorkoutSessionStore";
import type { EditorExerciseGroup } from "./model";

function workoutFixture(): Workout {
  return {
    id: "w1",
    date: new Date("2024-03-01T12:00:00.000Z"),
    dayId: "d1",
    dayNameSnapshot: "Push",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("createWorkoutSessionStore", () => {
  const persistence = {
    saveSet: vi.fn().mockResolvedValue("set-new"),
    updateSet: vi.fn().mockResolvedValue(undefined),
    deleteSet: vi.fn().mockResolvedValue(undefined),
    reorderSets: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applyReset replaces groups and notifies subscribers", () => {
    let w: Workout | null = workoutFixture();
    const store = createWorkoutSessionStore({
      variant: "workout",
      workoutId: "w1",
      persistence,
      debounceMs: 9999,
      getWorkout: () => w,
    });
    const sub = vi.fn();
    store.subscribe(sub);
    const seed: EditorExerciseGroup[] = [
      {
        groupKey: "ex1",
        exerciseId: "ex1",
        exerciseName: "Squat",
        rows: [{ id: "row-a", reps: 1, weight: 100, note: "" }],
      },
    ];
    store.applyReset(seed);
    expect(sub).toHaveBeenCalled();
    expect(store.getSnapshot().groups).toHaveLength(1);
    expect(store.getSnapshot().groups[0].rows[0].reps).toBe(1);
  });

  it("workout mode flush persists new set when reps positive", async () => {
    let w: Workout | null = workoutFixture();
    const store = createWorkoutSessionStore({
      variant: "workout",
      workoutId: "w1",
      persistence,
      debounceMs: 9999,
      getWorkout: () => w,
    });
    store.applyReset([
      {
        groupKey: "ex1",
        exerciseId: "ex1",
        exerciseName: "Squat",
        rows: [{ id: "row-a", reps: 0, weight: 0, note: "" }],
      },
    ]);
    const api = store.getRowApi("row-a");
    api.setField("reps", 5);
    await api.flush();
    expect(persistence.saveSet).toHaveBeenCalledOnce();
    expect(persistence.saveSet.mock.calls[0][0]).toMatchObject({
      workoutId: "w1",
      exerciseId: "ex1",
      order: 0,
    });
    expect(persistence.reorderSets).toHaveBeenCalledWith([
      { id: "set-new", order: 0 },
    ]);
    const snap = store.getSnapshot();
    expect(snap.groups[0].rows[0].persistedSetId).toBe("set-new");
    expect(snap.groups[0].rows[0].id).toBe("set-new");
  });

  it("addExercise appends a group", () => {
    let w: Workout | null = workoutFixture();
    const store = createWorkoutSessionStore({
      variant: "workout",
      workoutId: "w1",
      persistence,
      debounceMs: 9999,
      getWorkout: () => w,
    });
    store.applyReset([]);
    store.addExercise("e2", "Curl");
    expect(store.getSnapshot().groups).toHaveLength(1);
    expect(store.getSnapshot().groups[0].exerciseId).toBe("e2");
  });

  it("reorderExerciseGroups moves groups by key", () => {
    let w: Workout | null = workoutFixture();
    const store = createWorkoutSessionStore({
      variant: "workout",
      workoutId: "w1",
      persistence,
      debounceMs: 9999,
      getWorkout: () => w,
    });
    store.applyReset([
      {
        groupKey: "ex1",
        exerciseId: "ex1",
        exerciseName: "Squat",
        rows: [{ id: "row-a", reps: 1, weight: 100, note: "" }],
      },
      {
        groupKey: "ex2",
        exerciseId: "ex2",
        exerciseName: "Bench",
        rows: [{ id: "row-b", reps: 1, weight: 100, note: "" }],
      },
    ]);

    store.reorderExerciseGroups("ex2", "ex1");
    expect(store.getSnapshot().groups.map((g) => g.groupKey)).toEqual([
      "ex2",
      "ex1",
    ]);
  });

  it("debounces workout persist until delay elapses", async () => {
    vi.useFakeTimers();
    let w: Workout | null = workoutFixture();
    const store = createWorkoutSessionStore({
      variant: "workout",
      workoutId: "w1",
      persistence,
      debounceMs: 500,
      getWorkout: () => w,
    });
    store.applyReset([
      {
        groupKey: "ex1",
        exerciseId: "ex1",
        exerciseName: "Squat",
        rows: [{ id: "row-a", reps: 0, weight: 0, note: "" }],
      },
    ]);
    store.getRowApi("row-a").setField("reps", 5);
    expect(persistence.saveSet).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(persistence.saveSet).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("no-ops persist when workout is null", async () => {
    let w: Workout | null = null;
    const store = createWorkoutSessionStore({
      variant: "workout",
      workoutId: "w1",
      persistence,
      debounceMs: 9999,
      getWorkout: () => w,
    });
    store.applyReset([
      {
        groupKey: "ex1",
        exerciseId: "ex1",
        exerciseName: "Squat",
        rows: [{ id: "row-a", reps: 5, weight: 0, note: "" }],
      },
    ]);
    await store.getRowApi("row-a").flush();
    expect(persistence.saveSet).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import type { DataAccess } from "../../lib/dataAccess/types";
import type { Workout } from "../../types";
import {
  fetchWorkoutDetailWorkout,
  resolveWorkoutDetailEditorSeed,
  syncWorkoutDateAndSetsPerformedAt,
} from "./workoutDetailFlow";

type DataAccessMockOptions = {
  exercises?: DataAccess["exercises"];
  days?: DataAccess["days"];
  templates?: Partial<DataAccess["templates"]>;
  workouts?: Partial<DataAccess["workouts"]>;
  sets?: Partial<DataAccess["sets"]>;
  resolveExerciseNames?: DataAccess["resolveExerciseNames"];
  exportForBackup?: DataAccess["exportForBackup"];
};

function createDataAccessMock(partial: DataAccessMockOptions = {}): DataAccess {
  const reject = (): never => {
    throw new Error("not implemented");
  };
  return {
    exercises: partial.exercises ?? ({} as DataAccess["exercises"]),
    days: partial.days ?? ({} as DataAccess["days"]),
    templates: {
      listForDayWithExerciseNames: vi.fn(reject),
      listForDaysWithExerciseNames: vi.fn(reject),
      create: vi.fn(reject),
      update: vi.fn(reject),
      delete: vi.fn(reject),
      ...partial.templates,
    },
    workouts: {
      get: vi.fn(reject),
      getWithSets: vi.fn(reject),
      create: vi.fn(reject),
      update: vi.fn(reject),
      deleteWithSets: vi.fn(reject),
      getNotesByWorkoutIds: vi.fn(reject),
      listWithStats: vi.fn(reject),
      ...partial.workouts,
    },
    sets: {
      listForWorkout: vi.fn(reject),
      lastPerformedGroupForExercise: vi.fn(reject),
      listForExercise: vi.fn(reject),
      prForExercise: vi.fn(reject),
      create: vi.fn(reject),
      update: vi.fn(reject),
      delete: vi.fn(reject),
      ...partial.sets,
    },
    resolveExerciseNames: vi.fn(reject),
    exportForBackup: partial.exportForBackup ?? {
      allCollectionsRaw: vi.fn(reject),
      setsDocumentsForCsv: vi.fn(reject),
    },
  };
}

describe("fetchWorkoutDetailWorkout", () => {
  it("returns null when workoutId is undefined", async () => {
    const dataAccess = createDataAccessMock({});
    const w = await fetchWorkoutDetailWorkout(undefined, dataAccess);
    expect(w).toBeNull();
  });

  it("delegates to dataAccess.workouts.get", async () => {
    const workout: Workout & { id: string } = {
      id: "w1",
      date: new Date(),
      dayId: "d1",
      dayNameSnapshot: "Push",
      note: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const get = vi.fn().mockResolvedValue(workout);
    const dataAccess = createDataAccessMock({ workouts: { get } });

    const w = await fetchWorkoutDetailWorkout("w1", dataAccess);
    expect(get).toHaveBeenCalledWith("w1");
    expect(w).toEqual(workout);
  });
});

describe("resolveWorkoutDetailEditorSeed", () => {
  it("uses workout sets when the workout has sets", async () => {
    const listForWorkout = vi.fn().mockResolvedValue([
      {
        id: "s1",
        workoutId: "w1",
        exerciseId: "e1",
        exerciseNameSnapshot: "Squat",
        reps: 5,
        weight: 100,
        unit: "lbs",
        note: "",
        performedAt: new Date(),
        order: 0,
        createdAt: new Date(),
      },
    ]);
    const dataAccess = createDataAccessMock({ sets: { listForWorkout } });
    const workout: Workout & { id: string } = {
      id: "w1",
      date: new Date(),
      dayId: "d1",
      dayNameSnapshot: "Push",
      note: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const out = await resolveWorkoutDetailEditorSeed("w1", workout, dataAccess);

    expect(out.isTemplateMode).toBe(false);
    expect(out.editorSeed.variant).toBe("workout");
    expect(out.editorSeed.resetKey).toBe("w1-workout");
    expect(out.editorSeed.groups.length).toBe(1);
    expect(listForWorkout).toHaveBeenCalledWith("w1");
  });

  it("uses template path when there are no sets and workout has dayId", async () => {
    const listForWorkout = vi.fn().mockResolvedValue([]);
    const listForDayWithExerciseNames = vi.fn().mockResolvedValue([
      {
        id: "t1",
        dayId: "d1",
        exerciseId: "e1",
        numSets: 3,
        repsLower: 8,
        repsUpper: 12,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        exerciseDisplayName: "Squat",
      },
    ]);
    const lastPerformedGroupForExercise = vi
      .fn()
      .mockResolvedValue({ sets: [], workoutId: undefined });

    const dataAccess = createDataAccessMock({
      sets: { listForWorkout, lastPerformedGroupForExercise },
      templates: { listForDayWithExerciseNames },
    });

    const workout: Workout & { id: string } = {
      id: "w1",
      date: new Date(),
      dayId: "d1",
      dayNameSnapshot: "Push",
      note: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const onTemplateLoadingChange = vi.fn();
    const out = await resolveWorkoutDetailEditorSeed(
      "w1",
      workout,
      dataAccess,
      { onTemplateLoadingChange }
    );

    expect(onTemplateLoadingChange).toHaveBeenCalledWith(true);
    expect(onTemplateLoadingChange).toHaveBeenCalledWith(false);
    expect(out.isTemplateMode).toBe(true);
    expect(out.editorSeed.variant).toBe("template");
    expect(out.editorSeed.resetKey).toBe("w1-template");
    expect(listForDayWithExerciseNames).toHaveBeenCalledWith("d1");
    expect(lastPerformedGroupForExercise).toHaveBeenCalledWith("e1", "w1");
  });

  it("returns empty workout seed when there are no sets and no dayId", async () => {
    const listForWorkout = vi.fn().mockResolvedValue([]);
    const dataAccess = createDataAccessMock({ sets: { listForWorkout } });
    const workout: Workout & { id: string } = {
      id: "w1",
      date: new Date(),
      dayId: "",
      dayNameSnapshot: "Push",
      note: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const out = await resolveWorkoutDetailEditorSeed("w1", workout, dataAccess);

    expect(out.isTemplateMode).toBe(false);
    expect(out.editorSeed.variant).toBe("workout");
    expect(out.editorSeed.resetKey).toBe("w1-workout-empty");
    expect(out.editorSeed.groups).toEqual([]);
  });
});

describe("syncWorkoutDateAndSetsPerformedAt", () => {
  it("updates workout date then each set performedAt", async () => {
    const updateWorkout = vi.fn().mockResolvedValue(undefined);
    const listForWorkout = vi.fn().mockResolvedValue([
      {
        id: "s1",
        workoutId: "w1",
        exerciseId: "e1",
        exerciseNameSnapshot: "A",
        reps: 1,
        weight: 1,
        unit: "lbs",
        note: "",
        performedAt: new Date("2020-01-01"),
        order: 0,
        createdAt: new Date(),
      },
      {
        id: "s2",
        workoutId: "w1",
        exerciseId: "e2",
        exerciseNameSnapshot: "B",
        reps: 2,
        weight: 2,
        unit: "lbs",
        note: "",
        performedAt: new Date("2020-01-01"),
        order: 1,
        createdAt: new Date(),
      },
    ]);
    const updateSet = vi.fn().mockResolvedValue(undefined);

    const dataAccess = createDataAccessMock({
      workouts: { update: updateWorkout },
      sets: { listForWorkout, update: updateSet },
    });

    const newDate = new Date("2025-06-15T12:00:00Z");
    await syncWorkoutDateAndSetsPerformedAt(dataAccess, {
      workoutId: "w1",
      date: newDate,
    });

    expect(updateWorkout).toHaveBeenCalledWith("w1", { date: newDate });
    expect(listForWorkout).toHaveBeenCalledWith("w1");
    expect(updateSet).toHaveBeenCalledTimes(2);
    expect(updateSet).toHaveBeenNthCalledWith(1, "s1", {
      performedAt: newDate,
    });
    expect(updateSet).toHaveBeenNthCalledWith(2, "s2", {
      performedAt: newDate,
    });
  });
});

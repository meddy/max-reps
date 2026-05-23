import { describe, expect, it, vi } from "vitest";
import type {
  SetsDataSlice,
  TemplatesDataSlice,
  WorkoutsDataSlice,
} from "./dataAccessSlices";
import type { Workout } from "../../types";
import { createWorkoutDetailApi } from "./workoutDetailApi";

type DetailApiDepsMockOptions = {
  templates?: Partial<TemplatesDataSlice>;
  workouts?: Partial<WorkoutsDataSlice>;
  sets?: Partial<SetsDataSlice>;
};

function createDetailApiDeps(
  partial: DetailApiDepsMockOptions = {}
): Parameters<typeof createWorkoutDetailApi>[0] {
  const reject = (): never => {
    throw new Error("not implemented");
  };
  const t = partial.templates ?? {};
  const listForDayWithExerciseNames =
    t.listForDayWithExerciseNames ?? vi.fn(reject);
  const listForDaysWithExerciseNames =
    t.listForDaysWithExerciseNames ?? vi.fn(reject);
  const catalog = {
    forDay: listForDayWithExerciseNames,
    forDays: listForDaysWithExerciseNames,
  };
  return {
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
      reorder: vi.fn(reject),
      delete: vi.fn(reject),
      ...partial.sets,
    },
    templates: {
      catalog,
    },
  };
}

describe("createWorkoutDetailApi", () => {
  it("loadWorkoutDetail returns nulls when workoutId is empty", async () => {
    const api = createWorkoutDetailApi(createDetailApiDeps());
    const out = await api.loadWorkoutDetail("");
    expect(out.workout).toBeNull();
    expect(out.editorSeed).toBeNull();
    expect(out.isTemplateMode).toBe(false);
  });

  it("loadWorkoutDetail returns nulls when workout missing", async () => {
    const get = vi.fn().mockResolvedValue(null);
    const api = createWorkoutDetailApi(
      createDetailApiDeps({ workouts: { get } })
    );
    const out = await api.loadWorkoutDetail("w1");
    expect(get).toHaveBeenCalledWith("w1");
    expect(out.workout).toBeNull();
    expect(out.editorSeed).toBeNull();
  });

  it("loadWorkoutDetail uses workout sets when the workout has sets", async () => {
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
    const api = createWorkoutDetailApi(
      createDetailApiDeps({
        workouts: { get },
        sets: { listForWorkout },
      })
    );

    const out = await api.loadWorkoutDetail("w1");

    expect(out.isTemplateMode).toBe(false);
    expect(out.editorSeed?.variant).toBe("workout");
    expect(out.editorSeed?.resetKey).toBe("w1-workout");
    expect(out.editorSeed?.groups.length).toBe(1);
    expect(listForWorkout).toHaveBeenCalledWith("w1");
  });

  it("loadWorkoutDetail uses template path when there are no sets and workout has dayId", async () => {
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

    const api = createWorkoutDetailApi(
      createDetailApiDeps({
        workouts: { get },
        sets: { listForWorkout, lastPerformedGroupForExercise },
        templates: { listForDayWithExerciseNames },
      })
    );

    const onTemplateLoadingChange = vi.fn();
    const out = await api.loadWorkoutDetail("w1", {
      onTemplateLoadingChange,
    });

    expect(onTemplateLoadingChange).toHaveBeenCalledWith(true);
    expect(onTemplateLoadingChange).toHaveBeenCalledWith(false);
    expect(out.isTemplateMode).toBe(true);
    expect(out.editorSeed?.variant).toBe("template");
    expect(out.editorSeed?.resetKey).toBe("w1-template");
    expect(listForDayWithExerciseNames).toHaveBeenCalledWith("d1");
    expect(lastPerformedGroupForExercise).toHaveBeenCalledWith("e1", "w1");
  });

  it("loadWorkoutDetail returns empty workout seed when there are no sets and no dayId", async () => {
    const listForWorkout = vi.fn().mockResolvedValue([]);
    const workout: Workout & { id: string } = {
      id: "w1",
      date: new Date(),
      dayId: "",
      dayNameSnapshot: "Push",
      note: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const get = vi.fn().mockResolvedValue(workout);
    const api = createWorkoutDetailApi(
      createDetailApiDeps({ workouts: { get }, sets: { listForWorkout } })
    );

    const out = await api.loadWorkoutDetail("w1");

    expect(out.isTemplateMode).toBe(false);
    expect(out.editorSeed?.variant).toBe("workout");
    expect(out.editorSeed?.resetKey).toBe("w1-workout-empty");
    expect(out.editorSeed?.groups).toEqual([]);
  });

  it("updateWorkout delegates to workouts.update", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const api = createWorkoutDetailApi(
      createDetailApiDeps({ workouts: { update } })
    );
    const d = new Date("2025-06-15T12:00:00Z");
    await api.updateWorkout("w1", { date: d });
    expect(update).toHaveBeenCalledWith("w1", { date: d });
  });

  it("lastPerformedGroupForExercise delegates to sets", async () => {
    const lastPerformedGroupForExercise = vi
      .fn()
      .mockResolvedValue({ sets: [], workoutId: "w0" });
    const api = createWorkoutDetailApi(
      createDetailApiDeps({ sets: { lastPerformedGroupForExercise } })
    );
    await api.lastPerformedGroupForExercise("e1", "w2");
    expect(lastPerformedGroupForExercise).toHaveBeenCalledWith("e1", "w2");
  });

  it("deleteWorkoutWithSets delegates to workouts.deleteWithSets", async () => {
    const deleteWithSets = vi.fn().mockResolvedValue(undefined);
    const api = createWorkoutDetailApi(
      createDetailApiDeps({ workouts: { deleteWithSets } })
    );
    await api.deleteWorkoutWithSets("w9");
    expect(deleteWithSets).toHaveBeenCalledWith("w9");
  });

  it("loadFillTemplateData returns templates and last-performed sets (any-Day)", async () => {
    const workout: Workout & { id: string } = {
      id: "w1",
      date: new Date("2025-01-10T10:00:00Z"),
      dayId: "d1",
      dayNameSnapshot: "Push",
      note: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const get = vi.fn().mockResolvedValue(workout);
    const listForDayWithExerciseNames = vi.fn().mockResolvedValue([
      {
        id: "t1",
        dayId: "d1",
        exerciseId: "e1",
        numSets: 3,
        repsLower: 6,
        repsUpper: 8,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        exerciseDisplayName: "Bench",
      },
    ]);
    const lastPerformedGroupForExercise = vi.fn().mockResolvedValue({
      workoutId: "w-push",
      sets: [{ reps: 7, weight: 185, note: "pause" }],
    });

    const api = createWorkoutDetailApi(
      createDetailApiDeps({
        workouts: { get },
        sets: { lastPerformedGroupForExercise },
        templates: { listForDayWithExerciseNames },
      })
    );

    const out = await api.loadFillTemplateData("w1");

    expect(lastPerformedGroupForExercise).toHaveBeenCalledWith("e1", "w1");
    expect(out.dayTemplates).toHaveLength(1);
    expect(out.lastPerformedByExercise.e1).toEqual({
      workoutId: "w-push",
      sets: [{ reps: 7, weight: 185, note: "pause" }],
    });
  });

  it("loadFillTemplateData resolves last-performed per Set Target exercise", async () => {
    const workout: Workout & { id: string } = {
      id: "w1",
      date: new Date("2025-01-10T10:00:00Z"),
      dayId: "d-leg",
      dayNameSnapshot: "Leg",
      note: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const get = vi.fn().mockResolvedValue(workout);
    const listForDayWithExerciseNames = vi.fn().mockResolvedValue([
      {
        id: "t1",
        dayId: "d-leg",
        exerciseId: "e1",
        numSets: 3,
        repsLower: 6,
        repsUpper: 8,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        exerciseDisplayName: "Squat",
      },
      {
        id: "t2",
        dayId: "d-leg",
        exerciseId: "e2",
        numSets: 2,
        repsLower: 8,
        repsUpper: 12,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        exerciseDisplayName: "RDL",
      },
    ]);
    const lastPerformedGroupForExercise = vi
      .fn()
      .mockImplementation(async (exerciseId: string) => {
        if (exerciseId === "e1") {
          return {
            workoutId: "w-push",
            sets: [{ reps: 5, weight: 315, note: "" }],
          };
        }
        return { sets: [] };
      });

    const api = createWorkoutDetailApi(
      createDetailApiDeps({
        workouts: { get },
        sets: { lastPerformedGroupForExercise },
        templates: { listForDayWithExerciseNames },
      })
    );

    const out = await api.loadFillTemplateData("w1");

    expect(lastPerformedGroupForExercise).toHaveBeenCalledWith("e1", "w1");
    expect(lastPerformedGroupForExercise).toHaveBeenCalledWith("e2", "w1");
    expect(out.lastPerformedByExercise.e1?.workoutId).toBe("w-push");
    expect(out.lastPerformedByExercise.e2).toBeUndefined();
  });
});

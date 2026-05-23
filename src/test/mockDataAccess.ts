import { vi } from "vitest";
import { createDataAccess } from "../lib/dataAccess/createDataAccess";
import { buildWorkoutsSlice } from "../lib/dataAccess/workoutsSlice";
import { createWorkoutDetailApi } from "../lib/dataAccess/workoutDetailApi";
import type { DataAccess } from "../lib/dataAccess/types";
import { createInMemoryFirestoreDataPort } from "../lib/firestoreDataPort/inMemory";
import { createWorkoutEditorPersistence } from "../lib/workoutEditor/persistence";

function buildMockDataAccess() {
  const exercises = {
    get: vi.fn(),
    searchByNamePrefix: vi.fn(),
    listAllForSearch: vi.fn(),
    findByExactName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  };

  const days = {
    get: vi.fn(),
    searchByNamePrefix: vi.fn(),
    findByExactName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteWithTemplates: vi.fn(),
    list: vi.fn(),
  };

  const listForDayWithExerciseNames = vi.fn();
  const listForDaysWithExerciseNames = vi.fn();

  const templates = {
    catalog: {
      forDay: listForDayWithExerciseNames,
      forDays: listForDaysWithExerciseNames,
    },
    forDay: listForDayWithExerciseNames,
    forDays: listForDaysWithExerciseNames,
    listForDayWithExerciseNames,
    listForDaysWithExerciseNames,
    create: vi.fn(),
    update: vi.fn(),
    reorder: vi.fn(),
    delete: vi.fn(),
  };

  const workouts = {
    get: vi.fn(),
    getWithSets: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteWithSets: vi.fn(),
    getNotesByWorkoutIds: vi.fn(),
    listWithStats: vi.fn(),
  };

  const sets = {
    listForWorkout: vi.fn(),
    lastPerformedGroupForExercise: vi.fn(),
    listForExercise: vi.fn(),
    prForExercise: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    reorder: vi.fn(),
    delete: vi.fn(),
  };

  const exportForBackup = {
    allCollectionsRaw: vi.fn(async () => ({
      exercises: [] as Array<{ id: string } & Record<string, unknown>>,
      days: [] as Array<{ id: string } & Record<string, unknown>>,
      exerciseSetTemplates: [] as Array<
        { id: string } & Record<string, unknown>
      >,
      workouts: [] as Array<{ id: string } & Record<string, unknown>>,
      sets: [] as Array<{ id: string } & Record<string, unknown>>,
    })),
    setsDocumentsForCsv: vi.fn(
      async (): Promise<
        Array<{ id: string; data: Record<string, unknown> }>
      > => []
    ),
  };

  const workoutDetail = {
    loadWorkoutDetail: vi.fn(),
    updateWorkout: vi.fn(),
    editorPersistence: vi.fn(),
    lastPerformedGroupForExercise: vi.fn(),
    loadFillTemplateData: vi.fn(),
    deleteWorkoutWithSets: vi.fn(),
  };

  return {
    catalog: { exercises, days },
    exercises,
    days,
    templates,
    workouts,
    sets,
    resolveExerciseNames: vi.fn(),
    exportForBackup,
    workoutDetail,
  } satisfies DataAccess;
}

type BuiltMockDataAccess = ReturnType<typeof buildMockDataAccess>;

const detailFirestore = createInMemoryFirestoreDataPort();
const detailSaving = { start: () => {}, end: () => {} };
const detailWorkoutsSlice = buildWorkoutsSlice(detailFirestore, detailSaving);

function wireWorkoutDetail(da: BuiltMockDataAccess): void {
  const detailApi = createWorkoutDetailApi({
    workouts: da.workouts,
    sets: da.sets,
    templates: da.templates,
  });
  da.workoutDetail.loadWorkoutDetail.mockImplementation(
    detailApi.loadWorkoutDetail.bind(detailApi)
  );
  da.workoutDetail.updateWorkout.mockImplementation(
    detailApi.updateWorkout.bind(detailApi)
  );
  da.workoutDetail.editorPersistence.mockImplementation((getPerformedAt) =>
    createWorkoutEditorPersistence({ sets: da.sets, getPerformedAt })
  );
  da.workoutDetail.lastPerformedGroupForExercise.mockImplementation(
    detailApi.lastPerformedGroupForExercise.bind(detailApi)
  );
  da.workoutDetail.loadFillTemplateData.mockImplementation(
    detailApi.loadFillTemplateData.bind(detailApi)
  );
  da.workoutDetail.deleteWorkoutWithSets.mockImplementation(
    detailApi.deleteWorkoutWithSets.bind(detailApi)
  );
  da.workouts.update.mockImplementation((id, patch) =>
    detailWorkoutsSlice.update(id, patch)
  );
}

function seedDefaultResolvedValues(da: BuiltMockDataAccess): void {
  wireWorkoutDetail(da);

  da.exercises.get.mockResolvedValue(null);
  da.exercises.searchByNamePrefix.mockResolvedValue([]);
  da.exercises.listAllForSearch.mockResolvedValue([]);
  da.exercises.findByExactName.mockResolvedValue(null);
  da.exercises.create.mockResolvedValue("ex-new");
  da.exercises.update.mockResolvedValue(undefined);
  da.exercises.delete.mockResolvedValue(undefined);
  da.exercises.list.mockResolvedValue([]);

  da.days.get.mockResolvedValue(null);
  da.days.searchByNamePrefix.mockResolvedValue([]);
  da.days.findByExactName.mockResolvedValue(null);
  da.days.create.mockResolvedValue("day-new");
  da.days.update.mockResolvedValue(undefined);
  da.days.deleteWithTemplates.mockResolvedValue(undefined);
  da.days.list.mockResolvedValue([]);

  da.templates.listForDayWithExerciseNames.mockResolvedValue([]);
  da.templates.listForDaysWithExerciseNames.mockResolvedValue(new Map());
  da.templates.create.mockResolvedValue("tpl-new");
  da.templates.update.mockResolvedValue(undefined);
  da.templates.reorder.mockResolvedValue(undefined);
  da.templates.delete.mockResolvedValue(undefined);

  da.workouts.get.mockResolvedValue(null);
  da.workouts.getWithSets.mockResolvedValue(null);
  da.workouts.create.mockResolvedValue("w-new");
  da.workouts.deleteWithSets.mockResolvedValue(undefined);
  da.workouts.getNotesByWorkoutIds.mockResolvedValue({});
  da.workouts.listWithStats.mockResolvedValue([]);

  da.sets.listForWorkout.mockResolvedValue([]);
  da.sets.lastPerformedGroupForExercise.mockResolvedValue({
    sets: [],
  });
  da.sets.listForExercise.mockResolvedValue([]);
  da.sets.prForExercise.mockResolvedValue(null);
  da.sets.create.mockResolvedValue("set-new");
  da.sets.update.mockResolvedValue(undefined);
  da.sets.reorder.mockResolvedValue(undefined);
  da.sets.delete.mockResolvedValue(undefined);

  da.resolveExerciseNames.mockResolvedValue(new Map());

  da.exportForBackup.allCollectionsRaw.mockResolvedValue({
    exercises: [],
    days: [],
    exerciseSetTemplates: [],
    workouts: [],
    sets: [],
  });
  da.exportForBackup.setsDocumentsForCsv.mockResolvedValue([]);
}

/** Shared fakes; `setup.ts` merges this into the real `../lib/dataAccess` module as `dataAccess`. */
export const mockDataAccess = buildMockDataAccess();

export function resetDataAccessMocks(): void {
  seedDefaultResolvedValues(mockDataAccess);
}

/**
 * Isolated `DataAccess` test double with the same default resolutions as
 * `mockDataAccess`. Use when a suite must not share spy state with the global mock.
 */
export function createTestDataAccess(
  overrides: Partial<DataAccess> = {}
): BuiltMockDataAccess {
  const da = buildMockDataAccess();
  seedDefaultResolvedValues(da);
  if (overrides.exercises) {
    Object.assign(da.exercises, overrides.exercises);
  }
  if (overrides.days) {
    Object.assign(da.days, overrides.days);
  }
  if (overrides.templates) {
    Object.assign(da.templates, overrides.templates);
  }
  if (overrides.workouts) {
    Object.assign(da.workouts, overrides.workouts);
  }
  if (overrides.sets) {
    Object.assign(da.sets, overrides.sets);
  }
  if (overrides.exportForBackup) {
    Object.assign(da.exportForBackup, overrides.exportForBackup);
  }
  if (overrides.workoutDetail) {
    Object.assign(da.workoutDetail, overrides.workoutDetail);
  }
  if (overrides.catalog) {
    Object.assign(da.catalog, overrides.catalog);
  }
  return da;
}

/**
 * Full `createDataAccess` stack over an in-memory Firestore port — same assembly
 * as production (`getDefaultDataAccess`), without Firebase. Prefer for tests
 * that need real slice behavior end-to-end; use {@link createTestDataAccess}
 * when you need Vitest spies on individual methods.
 */
export function createIntegrationTestDataAccess(): DataAccess {
  return createDataAccess({
    firestore: createInMemoryFirestoreDataPort(),
    saving: { start: () => {}, end: () => {} },
  });
}

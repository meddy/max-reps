import { vi } from "vitest";
import type { DataAccess } from "../lib/dataAccess/types";

/** Shared fakes; `setup.ts` merges this into the real `../lib/dataAccess` module as `dataAccess`. */
const exercises = {
  get: vi.fn(),
  searchByNamePrefix: vi.fn(),
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

const templates = {
  listForDayWithExerciseNames: vi.fn(),
  listForDaysWithExerciseNames: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
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
  delete: vi.fn(),
};

const exportForBackup = {
  allCollectionsRaw: vi.fn(async () => ({
    exercises: [] as Array<{ id: string } & Record<string, unknown>>,
    days: [] as Array<{ id: string } & Record<string, unknown>>,
    exerciseSetTemplates: [] as Array<{ id: string } & Record<string, unknown>>,
    workouts: [] as Array<{ id: string } & Record<string, unknown>>,
    sets: [] as Array<{ id: string } & Record<string, unknown>>,
  })),
  setsDocumentsForCsv: vi.fn(
    async (): Promise<
      Array<{ id: string; data: Record<string, unknown> }>
    > => []
  ),
};

export const mockDataAccess = {
  exercises,
  days,
  templates,
  workouts,
  sets,
  resolveExerciseNames: vi.fn(),
  exportForBackup,
} satisfies DataAccess;

export function resetDataAccessMocks() {
  mockDataAccess.exercises.get.mockResolvedValue(null);
  mockDataAccess.exercises.searchByNamePrefix.mockResolvedValue([]);
  mockDataAccess.exercises.findByExactName.mockResolvedValue(null);
  mockDataAccess.exercises.create.mockResolvedValue("ex-new");
  mockDataAccess.exercises.update.mockResolvedValue(undefined);
  mockDataAccess.exercises.delete.mockResolvedValue(undefined);
  mockDataAccess.exercises.list.mockResolvedValue([]);

  mockDataAccess.days.get.mockResolvedValue(null);
  mockDataAccess.days.searchByNamePrefix.mockResolvedValue([]);
  mockDataAccess.days.findByExactName.mockResolvedValue(null);
  mockDataAccess.days.create.mockResolvedValue("day-new");
  mockDataAccess.days.update.mockResolvedValue(undefined);
  mockDataAccess.days.deleteWithTemplates.mockResolvedValue(undefined);
  mockDataAccess.days.list.mockResolvedValue([]);

  mockDataAccess.templates.listForDayWithExerciseNames.mockResolvedValue([]);
  mockDataAccess.templates.listForDaysWithExerciseNames.mockResolvedValue(
    new Map()
  );
  mockDataAccess.templates.create.mockResolvedValue("tpl-new");
  mockDataAccess.templates.update.mockResolvedValue(undefined);
  mockDataAccess.templates.delete.mockResolvedValue(undefined);

  mockDataAccess.workouts.get.mockResolvedValue(null);
  mockDataAccess.workouts.getWithSets.mockResolvedValue(null);
  mockDataAccess.workouts.create.mockResolvedValue("w-new");
  mockDataAccess.workouts.update.mockResolvedValue(undefined);
  mockDataAccess.workouts.deleteWithSets.mockResolvedValue(undefined);
  mockDataAccess.workouts.getNotesByWorkoutIds.mockResolvedValue({});
  mockDataAccess.workouts.listWithStats.mockResolvedValue([]);

  mockDataAccess.sets.listForWorkout.mockResolvedValue([]);
  mockDataAccess.sets.lastPerformedGroupForExercise.mockResolvedValue({
    sets: [],
  });
  mockDataAccess.sets.listForExercise.mockResolvedValue([]);
  mockDataAccess.sets.prForExercise.mockResolvedValue(null);
  mockDataAccess.sets.create.mockResolvedValue("set-new");
  mockDataAccess.sets.update.mockResolvedValue(undefined);
  mockDataAccess.sets.delete.mockResolvedValue(undefined);

  mockDataAccess.resolveExerciseNames.mockResolvedValue(new Map());

  mockDataAccess.exportForBackup.allCollectionsRaw.mockResolvedValue({
    exercises: [],
    days: [],
    exerciseSetTemplates: [],
    workouts: [],
    sets: [],
  });
  mockDataAccess.exportForBackup.setsDocumentsForCsv.mockResolvedValue([]);
}

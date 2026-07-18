import type {
  CollectionName,
  Day,
  Exercise,
  ExerciseSetTemplate,
  TemplateWithExerciseName,
  Workout,
  WorkoutSet,
} from "../../types";

/** Read path: templates with exercise display names joined and sorted per day. */
export interface TemplateCatalog {
  forDay(dayId: string): Promise<TemplateWithExerciseName[]>;
  forDays(dayIds: string[]): Promise<Map<string, TemplateWithExerciseName[]>>;
}

export interface ExercisesDataSlice {
  get(id: string): Promise<Exercise | null>;
  searchByNamePrefix(prefix: string, max?: number): Promise<Exercise[]>;
  listAllForSearch(opts?: {
    limit?: number;
    force?: boolean;
  }): Promise<Array<Exercise & { id: string }>>;
  findByExactName(nameLower: string): Promise<Exercise | null>;
  create(input: { nameLower: string; displayName: string }): Promise<string>;
  update(
    id: string,
    patch: Partial<Pick<Exercise, "nameLower" | "displayName">>
  ): Promise<void>;
  delete(id: string): Promise<void>;
  list(opts: {
    sort: "asc" | "desc";
    search?: string;
    limit?: number;
  }): Promise<Array<Exercise & { id: string }>>;
}

export interface DaysDataSlice {
  get(id: string): Promise<Day | null>;
  searchByNamePrefix(
    prefix: string,
    max?: number
  ): Promise<Array<Day & { id: string }>>;
  findByExactName(nameLower: string): Promise<Day | null>;
  create(input: { nameLower: string; displayName: string }): Promise<string>;
  update(
    id: string,
    patch: Partial<Pick<Day, "nameLower" | "displayName">>
  ): Promise<void>;
  deleteWithTemplates(id: string): Promise<void>;
  list(opts: {
    sort: "asc" | "desc";
    limit?: number;
  }): Promise<Array<Day & { id: string }>>;
}

export interface TemplatesDataSlice extends TemplateCatalog {
  catalog: TemplateCatalog;
  listForDayWithExerciseNames(
    dayId: string
  ): Promise<TemplateWithExerciseName[]>;
  listForDaysWithExerciseNames(
    dayIds: string[]
  ): Promise<Map<string, TemplateWithExerciseName[]>>;
  create(
    input: Omit<ExerciseSetTemplate, "id" | "createdAt" | "updatedAt">
  ): Promise<string>;
  update(
    id: string,
    patch: Partial<Omit<ExerciseSetTemplate, "id" | "createdAt" | "updatedAt">>
  ): Promise<void>;
  reorder(updates: Array<{ id: string; order: number }>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface WorkoutsDataSlice {
  get(id: string): Promise<(Workout & { id: string }) | null>;
  getWithSets(id: string): Promise<{
    workout: Workout & { id: string };
    sets: WorkoutSet[];
  } | null>;
  create(input: {
    date: Date;
    dayId: string;
    dayNameSnapshot: string;
    note?: string;
  }): Promise<string>;
  update(
    id: string,
    patch: Partial<Pick<Workout, "date" | "dayId" | "dayNameSnapshot" | "note">>
  ): Promise<void>;
  deleteWithSets(id: string): Promise<void>;
  getNotesByWorkoutIds(ids: string[]): Promise<Record<string, string>>;
  listRecent(opts: {
    sort: "asc" | "desc";
    limit?: number;
    startAfter?: { date: Date; id: string };
  }): Promise<Array<Workout & { id: string }>>;
  /**
   * Paginated Workouts plus one batched Set query for the page.
   * Sets are grouped client-side; no per-card Set reads.
   */
  listRecentWithSets(opts: {
    sort: "asc" | "desc";
    limit?: number;
    startAfter?: { date: Date; id: string };
  }): Promise<{
    workouts: Array<Workout & { id: string }>;
    setsByWorkoutId: Record<string, WorkoutSet[]>;
  }>;
  copyWithSets(input: {
    workout: {
      date: Date;
      dayId: string;
      dayNameSnapshot: string;
      note?: string;
    };
    sets: Array<{
      exerciseId: string;
      exerciseNameSnapshot: string;
      reps: number;
      weight: number;
      unit?: string;
      order: number;
    }>;
  }): Promise<{ workoutId: string; setIds: string[] }>;
}

export interface SetsDataSlice {
  listForWorkout(workoutId: string): Promise<WorkoutSet[]>;
  listForWorkouts(workoutIds: string[]): Promise<Record<string, WorkoutSet[]>>;
  lastPerformedGroupForExercise(
    exerciseId: string,
    excludeWorkoutId?: string
  ): Promise<{
    sets: Array<{ reps: number; weight: number; note?: string }>;
    workoutId?: string;
  }>;
  listForExercise(
    exerciseId: string,
    opts?: { limit?: number }
  ): Promise<Array<WorkoutSet & { id: string }>>;
  prForExercise(
    exerciseId: string
  ): Promise<(WorkoutSet & { id: string }) | null>;
  create(input: Omit<WorkoutSet, "id" | "createdAt">): Promise<string>;
  update(
    id: string,
    patch: Partial<Omit<WorkoutSet, "id" | "createdAt">>
  ): Promise<void>;
  reorder(updates: Array<{ id: string; order: number }>): Promise<void>;
  delete(id: string): Promise<void>;
  reconcileExercise(input: {
    workoutId: string;
    exerciseId: string;
    exerciseNameSnapshot: string;
    performedAt: Date;
    desiredSets: Array<{ reps: number; weight: number; note: string }>;
    currentSets: Array<{
      id: string;
      exerciseId: string;
      reps: number;
      weight: number;
      note: string;
      order: number;
    }>;
    exerciseOrder: string[];
  }): Promise<{ createdIds: string[] }>;
}

export interface ExportForBackupSlice {
  allCollectionsRaw(): Promise<
    Record<CollectionName, Array<{ id: string } & Record<string, unknown>>>
  >;
  setsDocumentsForCsv(
    limitCount: number
  ): Promise<Array<{ id: string; data: Record<string, unknown> }>>;
}

/** Composed persistence API without the workout-detail session facade. */
export interface DataAccessSlices {
  catalog: { exercises: ExercisesDataSlice; days: DaysDataSlice };
  exercises: ExercisesDataSlice;
  days: DaysDataSlice;
  templates: TemplatesDataSlice;
  workouts: WorkoutsDataSlice;
  sets: SetsDataSlice;
  resolveExerciseNames(ids: string[]): Promise<Map<string, string>>;
  /** Map of dayId → whether the Day document still exists. */
  resolveDayExistence(ids: string[]): Promise<Map<string, boolean>>;
  exportForBackup: ExportForBackupSlice;
}

import type { Firestore } from "firebase/firestore";
import type {
  CollectionName,
  Day,
  Exercise,
  ExerciseSetTemplate,
  TemplateWithExerciseName,
  Workout,
  WorkoutListItem,
  WorkoutSet,
} from "../../types";

export interface DataAccessDeps {
  db: Firestore;
  saving: { start: () => void; end: () => void };
}

export interface DataAccess {
  exercises: {
    get(id: string): Promise<Exercise | null>;
    searchByNamePrefix(prefix: string, max?: number): Promise<Exercise[]>;
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
  };
  days: {
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
  };
  templates: {
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
      patch: Partial<
        Omit<ExerciseSetTemplate, "id" | "createdAt" | "updatedAt">
      >
    ): Promise<void>;
    delete(id: string): Promise<void>;
  };
  workouts: {
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
      patch: Partial<
        Pick<Workout, "date" | "dayId" | "dayNameSnapshot" | "note">
      >
    ): Promise<void>;
    deleteWithSets(id: string): Promise<void>;
    getNotesByWorkoutIds(ids: string[]): Promise<Record<string, string>>;
    listWithStats(opts: {
      sort: "asc" | "desc";
      limit?: number;
    }): Promise<WorkoutListItem[]>;
  };
  sets: {
    listForWorkout(workoutId: string): Promise<WorkoutSet[]>;
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
    delete(id: string): Promise<void>;
  };
  resolveExerciseNames(ids: string[]): Promise<Map<string, string>>;
  /** Read-only bulk queries for Settings backup/export (no saving wrapper). */
  exportForBackup: {
    allCollectionsRaw(): Promise<
      Record<CollectionName, Array<{ id: string } & Record<string, unknown>>>
    >;
    setsDocumentsForCsv(
      limitCount: number
    ): Promise<Array<{ id: string; data: Record<string, unknown> }>>;
  };
}

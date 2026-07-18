import type { CollectionName } from "../../types";

/** Plain document shape returned by read operations (no Firebase types). */
export type RawDoc = { id: string; data: Record<string, unknown> };

export type CascadeSpec = { collection: CollectionName; field: string };
export type DocumentPatch = {
  collectionName: CollectionName;
  id: string;
  data: Record<string, unknown>;
};

/** Generic document CRUD, cascaded deletes, and workout date sync. */
export interface FirestoreCorePort {
  getDocument(
    collectionName: CollectionName,
    id: string
  ): Promise<RawDoc | null>;

  addDocument(
    collectionName: CollectionName,
    data: Record<string, unknown>
  ): Promise<string>;

  patchDocument(
    collectionName: CollectionName,
    id: string,
    data: Record<string, unknown>
  ): Promise<void>;

  patchDocuments(patches: DocumentPatch[]): Promise<void>;

  removeDocument(collectionName: CollectionName, id: string): Promise<void>;

  removeDocumentAndRelated(
    collectionName: CollectionName,
    id: string,
    cascades: CascadeSpec[]
  ): Promise<void>;

  /**
   * Sets workout `date` (with `updatedAt` on workouts) and every set's
   * `performedAt` for that workout. Batched in production; mirrors slice semantics.
   */
  syncWorkoutDateAndSetsPerformedAt(
    workoutId: string,
    date: Date
  ): Promise<void>;
}

export interface FirestoreExerciseQueryPort {
  queryExercisesByNamePrefix(term: string, max: number): Promise<RawDoc[]>;

  queryExerciseByNameLowerEqual(nameLower: string): Promise<RawDoc | null>;

  queryExercisesList(opts: {
    sort: "asc" | "desc";
    search?: string;
    limit: number;
  }): Promise<RawDoc[]>;

  /** Chunks `documentId() in` queries (max 10 per Firestore constraint). */
  queryExercisesWhereDocumentIdIn(ids: string[]): Promise<RawDoc[]>;
}

export interface FirestoreDayQueryPort {
  queryDaysByNamePrefix(term: string, max: number): Promise<RawDoc[]>;

  queryDayByNameLowerEqual(nameLower: string): Promise<RawDoc | null>;

  queryDaysList(opts: {
    sort: "asc" | "desc";
    limit: number;
  }): Promise<RawDoc[]>;

  /** Chunks `documentId() in` queries (max 10 per Firestore constraint). */
  queryDaysWhereDocumentIdIn(ids: string[]): Promise<RawDoc[]>;
}

export type ReconcileExerciseSetsInput = {
  workoutId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  performedAt: Date;
  /** Desired Sets for this exercise after reconcile (empty clears them). */
  desiredSets: Array<{ reps: number; weight: number; note: string }>;
  /**
   * All current Sets for the Workout (already loaded). Used to compute the
   * create/update/delete diff and global order patches without a prerequisite read.
   */
  currentSets: Array<{
    id: string;
    exerciseId: string;
    reps: number;
    weight: number;
    note: string;
    order: number;
  }>;
  /** Exercise IDs in display order after any DnD; drives global Set `order`. */
  exerciseOrder: string[];
};

export type ReconcileExerciseSetsResult = {
  /** IDs assigned to newly created Sets, in desired-set order among creates. */
  createdIds: string[];
};

export type CopyWorkoutWithSetsInput = {
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
};

export type CopyWorkoutWithSetsResult = {
  workoutId: string;
  setIds: string[];
};

export interface FirestoreWorkoutSetQueryPort {
  querySetsForWorkoutOrdered(workoutId: string): Promise<RawDoc[]>;

  queryWorkoutsByDate(opts: {
    sort: "asc" | "desc";
    limit: number;
    startAfter?: { date: Date; id: string };
  }): Promise<RawDoc[]>;

  querySetsByWorkoutId(workoutId: string): Promise<RawDoc[]>;

  /**
   * One or more `workoutId in [...]` queries (chunks of 10) returning all Sets
   * for the given Workouts. Caller groups/sorts client-side. Chunks run
   * sequentially — never fan out with Promise.all.
   */
  querySetsWhereWorkoutIdIn(workoutIds: string[]): Promise<RawDoc[]>;

  querySetsByExercisePerformedAtDesc(
    exerciseId: string,
    limit: number
  ): Promise<RawDoc[]>;

  querySetsPrForExercise(exerciseId: string): Promise<RawDoc | null>;
}

/** Atomic Set / Workout write helpers used by the inline Workout Editor. */
export interface FirestoreWorkoutMutationPort {
  /**
   * Atomically create/update/delete one exercise's Sets and apply every required
   * workout-wide order patch in a single batch. Throws if the op count exceeds
   * Firestore's batch limit — never silently splits.
   */
  reconcileExerciseSets(
    input: ReconcileExerciseSetsInput
  ): Promise<ReconcileExerciseSetsResult>;

  /**
   * Atomically create a Workout and all of its Sets in one batch.
   * Throws if the op count exceeds Firestore's batch limit.
   */
  copyWorkoutWithSets(
    input: CopyWorkoutWithSetsInput
  ): Promise<CopyWorkoutWithSetsResult>;
}

export interface FirestoreBulkQueryPort {
  /** Chunks `dayId in` queries (max 10 per Firestore constraint). */
  queryTemplatesWhereDayIdIn(dayIds: string[]): Promise<RawDoc[]>;

  queryCollectionDocuments(
    collectionName: CollectionName,
    limitCount: number
  ): Promise<RawDoc[]>;

  querySetsDocumentsForCsv(limitCount: number): Promise<RawDoc[]>;
}

/**
 * Full facade for Firestore access used by data-access slices and backup export.
 * Production: {@link createFirebaseFirestoreDataPort}; tests: in-memory fake.
 */
export type FirestoreDataPort = FirestoreCorePort &
  FirestoreExerciseQueryPort &
  FirestoreDayQueryPort &
  FirestoreWorkoutSetQueryPort &
  FirestoreWorkoutMutationPort &
  FirestoreBulkQueryPort;

/** Cascade deletes for days/workouts; see {@link removeWithCascade}. */
export type CascadeDeleteFirestorePort = Pick<
  FirestoreCorePort,
  "removeDocumentAndRelated"
>;

export type ExercisesSliceFirestorePort = FirestoreCorePort &
  FirestoreExerciseQueryPort;

export type DaysSliceFirestorePort = FirestoreCorePort & FirestoreDayQueryPort;

export type TemplatesSliceFirestorePort = FirestoreCorePort &
  Pick<FirestoreExerciseQueryPort, "queryExercisesWhereDocumentIdIn"> &
  Pick<FirestoreBulkQueryPort, "queryTemplatesWhereDayIdIn">;

export type WorkoutsSliceFirestorePort = FirestoreCorePort &
  FirestoreWorkoutSetQueryPort &
  FirestoreWorkoutMutationPort;

export type SetsSliceFirestorePort = Pick<
  FirestoreCorePort,
  "addDocument" | "patchDocument" | "patchDocuments" | "removeDocument"
> &
  Pick<
    FirestoreWorkoutSetQueryPort,
    | "querySetsForWorkoutOrdered"
    | "querySetsWhereWorkoutIdIn"
    | "querySetsByExercisePerformedAtDesc"
    | "querySetsPrForExercise"
  > &
  Pick<FirestoreWorkoutMutationPort, "reconcileExerciseSets">;

export type ExportForBackupFirestorePort = Pick<
  FirestoreBulkQueryPort,
  "queryCollectionDocuments" | "querySetsDocumentsForCsv"
>;

export type ResolveExerciseNamesFirestorePort = Pick<
  FirestoreExerciseQueryPort,
  "queryExercisesWhereDocumentIdIn"
>;

export type ResolveDayExistenceFirestorePort = Pick<
  FirestoreDayQueryPort,
  "queryDaysWhereDocumentIdIn"
>;

export type TemplatesWithNamesFirestorePort =
  ResolveExerciseNamesFirestorePort &
    Pick<FirestoreBulkQueryPort, "queryTemplatesWhereDayIdIn">;

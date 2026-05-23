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
}

export interface FirestoreWorkoutSetQueryPort {
  querySetsForWorkoutOrdered(workoutId: string): Promise<RawDoc[]>;

  queryWorkoutsByDate(opts: {
    sort: "asc" | "desc";
    limit: number;
  }): Promise<RawDoc[]>;

  querySetsByWorkoutId(workoutId: string): Promise<RawDoc[]>;

  querySetsByExercisePerformedAtDesc(
    exerciseId: string,
    limit: number
  ): Promise<RawDoc[]>;

  querySetsPrForExercise(exerciseId: string): Promise<RawDoc | null>;
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
  FirestoreWorkoutSetQueryPort;

export type SetsSliceFirestorePort = Pick<
  FirestoreCorePort,
  "addDocument" | "patchDocument" | "patchDocuments" | "removeDocument"
> &
  Pick<
    FirestoreWorkoutSetQueryPort,
    | "querySetsForWorkoutOrdered"
    | "querySetsByExercisePerformedAtDesc"
    | "querySetsPrForExercise"
  >;

export type ExportForBackupFirestorePort = Pick<
  FirestoreBulkQueryPort,
  "queryCollectionDocuments" | "querySetsDocumentsForCsv"
>;

export type ResolveExerciseNamesFirestorePort = Pick<
  FirestoreExerciseQueryPort,
  "queryExercisesWhereDocumentIdIn"
>;

export type TemplatesWithNamesFirestorePort =
  ResolveExerciseNamesFirestorePort &
    Pick<FirestoreBulkQueryPort, "queryTemplatesWhereDayIdIn">;

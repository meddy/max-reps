import type { CollectionName } from "../../types";

/** Plain document shape returned by read operations (no Firebase types). */
export type RawDoc = { id: string; data: Record<string, unknown> };

export type CascadeSpec = { collection: CollectionName; field: string };

/**
 * Full facade for Firestore access used by data-access slices and backup export.
 * Production: {@link createFirebaseFirestoreDataPort}; tests: in-memory fake.
 */
export interface FirestoreDataPort {
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

  queryExercisesByNamePrefix(term: string, max: number): Promise<RawDoc[]>;

  queryExerciseByNameLowerEqual(nameLower: string): Promise<RawDoc | null>;

  queryExercisesList(opts: {
    sort: "asc" | "desc";
    search?: string;
    limit: number;
  }): Promise<RawDoc[]>;

  queryDaysByNamePrefix(term: string, max: number): Promise<RawDoc[]>;

  queryDayByNameLowerEqual(nameLower: string): Promise<RawDoc | null>;

  queryDaysList(opts: {
    sort: "asc" | "desc";
    limit: number;
  }): Promise<RawDoc[]>;

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

  /** Chunks `documentId() in` queries (max 10 per Firestore constraint). */
  queryExercisesWhereDocumentIdIn(ids: string[]): Promise<RawDoc[]>;

  /** Chunks `dayId in` queries (max 10 per Firestore constraint). */
  queryTemplatesWhereDayIdIn(dayIds: string[]): Promise<RawDoc[]>;

  queryCollectionDocuments(
    collectionName: CollectionName,
    limitCount: number
  ): Promise<RawDoc[]>;

  querySetsDocumentsForCsv(limitCount: number): Promise<RawDoc[]>;
}

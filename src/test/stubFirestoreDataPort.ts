import { vi } from "vitest";
import type { FirestoreDataPort } from "../lib/firestoreDataPort/types";

/**
 * Test double for {@link FirestoreDataPort}: every method rejects unless overridden.
 * Centralizes the wide port surface so stubs stay in sync with production.
 */
export function createStubFirestoreDataPort(
  partial: Partial<FirestoreDataPort> = {}
): FirestoreDataPort {
  const reject = (): Promise<never> =>
    Promise.reject(new Error("not implemented in stub"));
  return {
    getDocument: vi.fn(reject),
    addDocument: vi.fn(reject),
    patchDocument: vi.fn(reject),
    removeDocument: vi.fn(reject),
    removeDocumentAndRelated: vi.fn(reject),
    syncWorkoutDateAndSetsPerformedAt: vi.fn(reject),
    queryExercisesByNamePrefix: vi.fn(reject),
    queryExerciseByNameLowerEqual: vi.fn(reject),
    queryExercisesList: vi.fn(reject),
    queryDaysByNamePrefix: vi.fn(reject),
    queryDayByNameLowerEqual: vi.fn(reject),
    queryDaysList: vi.fn(reject),
    querySetsForWorkoutOrdered: vi.fn(reject),
    queryWorkoutsByDate: vi.fn(reject),
    querySetsByWorkoutId: vi.fn(reject),
    querySetsByExercisePerformedAtDesc: vi.fn(reject),
    querySetsPrForExercise: vi.fn(reject),
    queryExercisesWhereDocumentIdIn: vi.fn(reject),
    queryTemplatesWhereDayIdIn: vi.fn(reject),
    queryCollectionDocuments: vi.fn(reject),
    querySetsDocumentsForCsv: vi.fn(reject),
    ...partial,
  };
}

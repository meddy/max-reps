import type { ResolveExerciseNamesFirestorePort } from "../firestoreDataPort/types";
import { mapExerciseFromDoc } from "../firestoreModelMappers";

export type ExerciseResolution = {
  id: string;
  exists: boolean;
  displayName?: string;
};

/**
 * Cache of Exercise existence/names across loaded Workout pages.
 * Only issues `documentId in` queries for previously unseen IDs.
 */
export function createExerciseResolutionCache(
  firestore: ResolveExerciseNamesFirestorePort
) {
  const cache = new Map<string, ExerciseResolution>();

  return {
    getCached(id: string): ExerciseResolution | undefined {
      return cache.get(id);
    },

    peekAll(): Map<string, ExerciseResolution> {
      return new Map(cache);
    },

    async resolve(ids: string[]): Promise<Map<string, ExerciseResolution>> {
      const unique = [...new Set(ids.filter(Boolean))];
      const missing = unique.filter((id) => !cache.has(id));
      if (missing.length > 0) {
        const rows = await firestore.queryExercisesWhereDocumentIdIn(missing);
        const found = new Map(
          rows.map((r) => {
            const exercise = mapExerciseFromDoc(r.id, r.data);
            return [
              r.id,
              {
                id: r.id,
                exists: true,
                displayName: exercise.displayName,
              } satisfies ExerciseResolution,
            ] as const;
          })
        );
        for (const id of missing) {
          cache.set(id, found.get(id) ?? { id, exists: false });
        }
      }
      const out = new Map<string, ExerciseResolution>();
      for (const id of unique) {
        out.set(id, cache.get(id)!);
      }
      return out;
    },
  };
}

export type ExerciseResolutionCache = ReturnType<
  typeof createExerciseResolutionCache
>;

/** Build a resolution cache from DataAccess.resolveExerciseNames. */
export function createExerciseResolutionCacheFromNames(
  resolveNames: (ids: string[]) => Promise<Map<string, string>>
) {
  const cache = new Map<string, ExerciseResolution>();
  return {
    async resolve(ids: string[]): Promise<Map<string, ExerciseResolution>> {
      const unique = [...new Set(ids.filter(Boolean))];
      const missing = unique.filter((id) => !cache.has(id));
      if (missing.length > 0) {
        const names = await resolveNames(missing);
        for (const id of missing) {
          const displayName = names.get(id);
          cache.set(
            id,
            displayName
              ? { id, exists: true, displayName }
              : { id, exists: false }
          );
        }
      }
      const out = new Map<string, ExerciseResolution>();
      for (const id of unique) out.set(id, cache.get(id)!);
      return out;
    },
  };
}

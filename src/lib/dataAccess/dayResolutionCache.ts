export type DayResolution = {
  id: string;
  exists: boolean;
};

/**
 * Cache of Day existence across loaded Workout pages.
 * Only queries previously unseen IDs.
 */
export function createDayExistenceCache(
  resolveExistence: (ids: string[]) => Promise<Map<string, boolean>>
) {
  const cache = new Map<string, DayResolution>();
  return {
    async resolve(ids: string[]): Promise<Map<string, DayResolution>> {
      const unique = [...new Set(ids.filter(Boolean))];
      const missing = unique.filter((id) => !cache.has(id));
      if (missing.length > 0) {
        const existence = await resolveExistence(missing);
        for (const id of missing) {
          cache.set(id, {
            id,
            exists: existence.get(id) === true,
          });
        }
      }
      const out = new Map<string, DayResolution>();
      for (const id of unique) out.set(id, cache.get(id)!);
      return out;
    },
  };
}

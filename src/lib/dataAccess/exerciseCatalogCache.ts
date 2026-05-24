import type { Exercise } from "../../types";

export type CatalogExercise = Exercise & { id: string };

const TTL_MS = 24 * 60 * 60 * 1000;

let cached: CatalogExercise[] | null = null;
let fetchedAt = 0;
let inFlight: Promise<CatalogExercise[]> | null = null;
let loadGeneration = 0;

function compareByNameLower(a: CatalogExercise, b: CatalogExercise): number {
  return a.nameLower.localeCompare(b.nameLower);
}

function isCacheFresh(): boolean {
  return cached !== null && Date.now() - fetchedAt < TTL_MS;
}

export function clearExerciseCatalogCache(): void {
  cached = null;
  fetchedAt = 0;
  inFlight = null;
  loadGeneration += 1;
}

export function findInExerciseCatalog(id: string): CatalogExercise | undefined {
  return cached?.find((e) => e.id === id);
}

export function patchExerciseCatalog(exercise: CatalogExercise): void {
  if (cached === null) return;
  const idx = cached.findIndex((e) => e.id === exercise.id);
  if (idx >= 0) {
    cached = [...cached.slice(0, idx), exercise, ...cached.slice(idx + 1)];
  } else {
    cached = [...cached, exercise];
  }
  cached.sort(compareByNameLower);
}

export function removeFromExerciseCatalog(id: string): void {
  if (cached === null) return;
  cached = cached.filter((e) => e.id !== id);
}

export async function getExerciseCatalog(
  loader: () => Promise<CatalogExercise[]>,
  opts?: { force?: boolean }
): Promise<CatalogExercise[]> {
  const force = opts?.force ?? false;

  if (!force && isCacheFresh()) {
    return cached!;
  }

  if (!force && inFlight !== null) {
    return inFlight;
  }

  const gen = ++loadGeneration;
  const promise = loader().then((exercises) => {
    if (gen === loadGeneration) {
      cached = exercises;
      fetchedAt = Date.now();
      inFlight = null;
    }
    return exercises;
  });

  inFlight = promise;
  return promise;
}

/** @internal — tests only */
export function __resetExerciseCatalogCacheForTests(): void {
  clearExerciseCatalogCache();
}

/** @internal — tests only */
export function __setExerciseCatalogCacheForTests(
  exercises: CatalogExercise[],
  fetchedAtMs: number
): void {
  cached = exercises;
  fetchedAt = fetchedAtMs;
  inFlight = null;
}

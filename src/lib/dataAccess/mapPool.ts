/**
 * Run async work over items with a hard concurrency cap.
 * Used for Firestore read chunks so Safari is never hit with unbounded fan-out.
 */
export async function mapPool<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const limit = Math.max(1, Math.floor(concurrency));
  const results: R[] = Array.from({ length: items.length });
  let nextIndex = 0;

  async function run(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    run()
  );
  await Promise.all(runners);
  return results;
}

/** Default hard cap for concurrent Firestore reads on the Workouts page. */
export const WORKOUTS_READ_CONCURRENCY = 2;

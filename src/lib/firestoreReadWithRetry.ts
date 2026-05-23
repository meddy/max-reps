import type { Firestore } from "firebase/firestore";

const READ_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 500;

/**
 * Times out stuck Firestore reads (common when iOS Safari resumes a background tab)
 * and retries once. Does not call enableNetwork — that corrupts in-flight listeners.
 */
export async function firestoreReadWithRetry<T>(
  _db: Firestore,
  label: string,
  op: () => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await Promise.race([
        op(),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Firestore read timed out (${label})`)),
            READ_TIMEOUT_MS
          );
        }),
      ]);
    } catch (err) {
      lastError = err;
      if (attempt >= MAX_RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw lastError;
}

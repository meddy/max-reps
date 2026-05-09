/**
 * Recognises errors that surface when a previously-built lazy chunk is no longer
 * available on the server (typical after a redeploy invalidates hashed asset URLs).
 * The caller can use this signal to recover by reloading the entry document.
 */
const CHUNK_LOAD_MESSAGE_FRAGMENTS = [
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
] as const;

export function isChunkLoadError(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false;
  const candidate = err as { name?: unknown; message?: unknown };
  if (candidate.name === "ChunkLoadError") return true;
  if (typeof candidate.message !== "string") return false;
  return CHUNK_LOAD_MESSAGE_FRAGMENTS.some((fragment) =>
    (candidate.message as string).includes(fragment)
  );
}

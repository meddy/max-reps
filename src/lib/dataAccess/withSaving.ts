export function withSaving<T>(
  saving: { start: () => void; end: () => void },
  fn: () => Promise<T>
): Promise<T> {
  saving.start();
  return (async () => {
    try {
      return await fn();
    } finally {
      saving.end();
    }
  })();
}

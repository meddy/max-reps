export type WriteQueueCommand = {
  id: string;
  /** Monotonic draft revision this command was built from. */
  revision: number;
  label: string;
  run: () => Promise<void>;
};

export type WriteQueueStatus = "idle" | "pending" | "failed";

export type WriteQueueSnapshot = {
  status: WriteQueueStatus;
  pendingCount: number;
  error: Error | null;
  failedCommandId: string | null;
};

type Listener = () => void;

/**
 * Per-Workout FIFO write queue with coalescing for not-yet-started commands
 * that share a coalesce key (typically an exercise id).
 */
export function createWriteQueue() {
  let status: WriteQueueStatus = "idle";
  let error: Error | null = null;
  let failedCommandId: string | null = null;
  let running = false;
  const queue: Array<WriteQueueCommand & { coalesceKey?: string }> = [];
  const listeners = new Set<Listener>();
  let cachedSnapshot: WriteQueueSnapshot = {
    status: "idle",
    pendingCount: 0,
    error: null,
    failedCommandId: null,
  };

  function emit() {
    cachedSnapshot = {
      status,
      pendingCount: queue.length + (running ? 1 : 0),
      error,
      failedCommandId,
    };
    for (const listener of listeners) listener();
  }

  function getSnapshot(): WriteQueueSnapshot {
    return cachedSnapshot;
  }

  async function pump(): Promise<void> {
    if (running || status === "failed") return;
    const next = queue.shift();
    if (!next) {
      status = "idle";
      emit();
      return;
    }
    running = true;
    status = "pending";
    emit();
    try {
      await next.run();
      running = false;
      emit();
      await pump();
    } catch (err) {
      running = false;
      status = "failed";
      error = err instanceof Error ? err : new Error(String(err));
      failedCommandId = next.id;
      queue.unshift(next);
      emit();
    }
  }

  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot,
    enqueue(command: WriteQueueCommand & { coalesceKey?: string }): void {
      if (status !== "failed") {
        status = "pending";
        error = null;
        failedCommandId = null;
      }
      if (command.coalesceKey) {
        const idx = queue.findIndex(
          (c) => c.coalesceKey === command.coalesceKey
        );
        if (idx >= 0) {
          queue[idx] = command;
          emit();
          void pump();
          return;
        }
      }
      queue.push(command);
      emit();
      void pump();
    },
    retry(): void {
      if (status !== "failed") return;
      error = null;
      failedCommandId = null;
      status = "pending";
      emit();
      void pump();
    },
    async drain(): Promise<void> {
      if (status === "failed") {
        throw error ?? new Error("Write queue failed");
      }
      if (status === "idle" && queue.length === 0 && !running) return;
      await new Promise<void>((resolve, reject) => {
        const unsub = this.subscribe(() => {
          const snap = getSnapshot();
          if (snap.status === "failed") {
            unsub();
            reject(snap.error ?? new Error("Write queue failed"));
          } else if (snap.status === "idle" && snap.pendingCount === 0) {
            unsub();
            resolve();
          }
        });
        const snap = getSnapshot();
        if (snap.status === "idle" && snap.pendingCount === 0) {
          unsub();
          resolve();
        } else if (snap.status === "failed") {
          unsub();
          reject(snap.error ?? new Error("Write queue failed"));
        }
      });
    },
    clear() {
      queue.length = 0;
      status = "idle";
      error = null;
      failedCommandId = null;
      emit();
    },
  };
}

export type WriteQueue = ReturnType<typeof createWriteQueue>;

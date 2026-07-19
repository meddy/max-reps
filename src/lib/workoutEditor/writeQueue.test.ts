import { describe, expect, it, vi } from "vitest";
import { createWriteQueue } from "./writeQueue";

function defer<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createWriteQueue", () => {
  it("runs commands FIFO and reaches idle", async () => {
    const q = createWriteQueue();
    const order: string[] = [];
    q.enqueue({
      id: "1",
      revision: 1,
      label: "a",
      run: async () => {
        order.push("a");
      },
    });
    q.enqueue({
      id: "2",
      revision: 2,
      label: "b",
      run: async () => {
        order.push("b");
      },
    });
    await q.drain();
    expect(order).toEqual(["a", "b"]);
    expect(q.getSnapshot().status).toBe("idle");
  });

  it("coalesces not-yet-started commands with the same key", async () => {
    const q = createWriteQueue();
    const gate = defer<void>();
    const runs: number[] = [];

    q.enqueue({
      id: "block",
      revision: 0,
      label: "block",
      run: () => gate.promise,
    });
    q.enqueue({
      id: "e1-r1",
      revision: 1,
      label: "ex",
      coalesceKey: "e1",
      run: async () => {
        runs.push(1);
      },
    });
    q.enqueue({
      id: "e1-r2",
      revision: 2,
      label: "ex",
      coalesceKey: "e1",
      run: async () => {
        runs.push(2);
      },
    });

    gate.resolve();
    await q.drain();
    expect(runs).toEqual([2]);
  });

  it("pauses on failure and retries the same failed command", async () => {
    const q = createWriteQueue();
    let shouldFail = true;
    const run = vi.fn(async () => {
      if (shouldFail) throw new Error("boom");
    });

    q.enqueue({
      id: "cmd",
      revision: 1,
      label: "x",
      coalesceKey: "e1",
      run,
    });

    await vi.waitFor(() => expect(q.getSnapshot().status).toBe("failed"));
    expect(q.getSnapshot().error?.message).toBe("boom");

    shouldFail = false;
    q.retry();
    await q.drain();
    expect(q.getSnapshot().status).toBe("idle");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("never lets a later command overtake a failed one", async () => {
    const q = createWriteQueue();
    const order: string[] = [];
    q.enqueue({
      id: "fail",
      revision: 1,
      label: "fail",
      run: async () => {
        order.push("fail");
        throw new Error("nope");
      },
    });
    q.enqueue({
      id: "later",
      revision: 2,
      label: "later",
      run: async () => {
        order.push("later");
      },
    });
    await vi.waitFor(() => expect(q.getSnapshot().status).toBe("failed"));
    expect(order).toEqual(["fail"]);
    expect(q.getSnapshot().pendingCount).toBeGreaterThan(0);
  });
});

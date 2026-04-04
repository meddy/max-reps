import { describe, expect, it, vi } from "vitest";
import { withSaving } from "./withSaving";

describe("withSaving", () => {
  it("calls start before the work and end after success", async () => {
    const saving = { start: vi.fn(), end: vi.fn() };
    const result = await withSaving(saving, async () => 42);

    expect(result).toBe(42);
    expect(saving.start).toHaveBeenCalledOnce();
    expect(saving.end).toHaveBeenCalledOnce();
    expect(saving.start.mock.invocationCallOrder[0]).toBeLessThan(
      saving.end.mock.invocationCallOrder[0]
    );
  });

  it("calls end in finally when the promise rejects", async () => {
    const saving = { start: vi.fn(), end: vi.fn() };
    const err = new Error("fail");

    await expect(
      withSaving(saving, async () => {
        throw err;
      })
    ).rejects.toThrow(err);

    expect(saving.start).toHaveBeenCalledOnce();
    expect(saving.end).toHaveBeenCalledOnce();
  });
});

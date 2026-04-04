import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endSaving, getSnapshot, startSaving, subscribe } from "./savingStore";

describe("savingStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    for (let i = 0; i < 10; i++) endSaving();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("getSnapshot is false when idle", () => {
    expect(getSnapshot()).toBe(false);
  });

  it("increments refcount on startSaving and decrements on endSaving", () => {
    startSaving();
    expect(getSnapshot()).toBe(true);
    endSaving();
    vi.runAllTimers();
    expect(getSnapshot()).toBe(false);
  });

  it("nested start/end only clears after outermost end and MIN_DISPLAY_MS", () => {
    startSaving();
    startSaving();
    endSaving();
    expect(getSnapshot()).toBe(true);
    endSaving();
    expect(getSnapshot()).toBe(true);
    vi.advanceTimersByTime(999);
    expect(getSnapshot()).toBe(true);
    vi.advanceTimersByTime(1);
    vi.runAllTimers();
    expect(getSnapshot()).toBe(false);
  });

  it("notifies subscribers when saving state changes", () => {
    const cb = vi.fn();
    const unsub = subscribe(cb);
    expect(cb).not.toHaveBeenCalled();

    startSaving();
    expect(cb).toHaveBeenCalledTimes(1);

    endSaving();
    expect(cb).toHaveBeenCalledTimes(2);

    unsub();
    startSaving();
    expect(cb).toHaveBeenCalledTimes(2);

    endSaving();
    vi.runOnlyPendingTimers();
  });
});

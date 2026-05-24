import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogExercise } from "./exerciseCatalogCache";
import {
  __resetExerciseCatalogCacheForTests,
  __setExerciseCatalogCacheForTests,
  clearExerciseCatalogCache,
  getExerciseCatalog,
  patchExerciseCatalog,
  removeFromExerciseCatalog,
} from "./exerciseCatalogCache";

const bench: CatalogExercise = {
  id: "bench",
  nameLower: "bench press",
  displayName: "Bench Press",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const curl: CatalogExercise = {
  id: "curl",
  nameLower: "curl",
  displayName: "Curl",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

describe("exerciseCatalogCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetExerciseCatalogCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls loader on cache miss", async () => {
    const loader = vi.fn().mockResolvedValue([bench]);
    const result = await getExerciseCatalog(loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(result).toEqual([bench]);
  });

  it("returns cached catalog without calling loader again", async () => {
    const loader = vi.fn().mockResolvedValue([bench]);
    await getExerciseCatalog(loader);
    const second = await getExerciseCatalog(loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(second).toEqual([bench]);
  });

  it("dedupes concurrent loads into one loader call", async () => {
    let resolveLoader!: (value: CatalogExercise[]) => void;
    const loader = vi.fn(
      () =>
        new Promise<CatalogExercise[]>((resolve) => {
          resolveLoader = resolve;
        })
    );
    const p1 = getExerciseCatalog(loader);
    const p2 = getExerciseCatalog(loader);
    expect(loader).toHaveBeenCalledTimes(1);
    resolveLoader([bench]);
    await expect(Promise.all([p1, p2])).resolves.toEqual([[bench], [bench]]);
  });

  it("refetches after TTL expires", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce([bench])
      .mockResolvedValueOnce([curl]);
    await getExerciseCatalog(loader);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    const second = await getExerciseCatalog(loader);
    expect(loader).toHaveBeenCalledTimes(2);
    expect(second).toEqual([curl]);
  });

  it("force bypasses warm cache", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce([bench])
      .mockResolvedValueOnce([curl]);
    await getExerciseCatalog(loader);
    const forced = await getExerciseCatalog(loader, { force: true });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(forced).toEqual([curl]);
  });

  it("patchExerciseCatalog keeps catalog sorted", async () => {
    __setExerciseCatalogCacheForTests([curl], Date.now());
    patchExerciseCatalog(bench);
    const loader = vi.fn();
    const list = await getExerciseCatalog(loader);
    expect(loader).not.toHaveBeenCalled();
    expect(list.map((e) => e.id)).toEqual(["bench", "curl"]);
  });

  it("removeFromExerciseCatalog drops an exercise", async () => {
    __setExerciseCatalogCacheForTests([bench, curl], Date.now());
    removeFromExerciseCatalog("bench");
    const loader = vi.fn();
    const list = await getExerciseCatalog(loader);
    expect(list).toEqual([curl]);
    expect(loader).not.toHaveBeenCalled();
  });

  it("clearExerciseCatalogCache forces next load to call loader", async () => {
    const loader = vi.fn().mockResolvedValue([bench]);
    await getExerciseCatalog(loader);
    clearExerciseCatalogCache();
    await getExerciseCatalog(loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

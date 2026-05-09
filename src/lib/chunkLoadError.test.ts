import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "./chunkLoadError";

describe("isChunkLoadError", () => {
  it("matches an error whose name is ChunkLoadError", () => {
    const err = new Error("anything");
    err.name = "ChunkLoadError";
    expect(isChunkLoadError(err)).toBe(true);
  });

  it("matches the Vite/Chrome message", () => {
    const err = new TypeError(
      "Failed to fetch dynamically imported module: https://example.com/assets/Page-abc.js"
    );
    expect(isChunkLoadError(err)).toBe(true);
  });

  it("matches the alternate Vite message", () => {
    const err = new Error(
      "error loading dynamically imported module: /assets/Page-abc.js"
    );
    expect(isChunkLoadError(err)).toBe(true);
  });

  it("matches the iOS Safari message", () => {
    const err = new Error("Importing a module script failed.");
    expect(isChunkLoadError(err)).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isChunkLoadError(new Error("Permission denied"))).toBe(false);
    expect(isChunkLoadError(new TypeError("foo is undefined"))).toBe(false);
  });

  it("returns false for non-Error inputs", () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(
      isChunkLoadError("Failed to fetch dynamically imported module")
    ).toBe(false);
    expect(isChunkLoadError(42)).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  isDragStartAllowed,
  shouldPreventSelectionDuringDrag,
} from "./guardedSensors";

describe("guardedSensors", () => {
  it("allows drag start on non-interactive content", () => {
    const node = document.createElement("div");
    expect(isDragStartAllowed(node)).toBe(true);
  });

  it("blocks drag start on interactive descendants", () => {
    const button = document.createElement("button");
    expect(isDragStartAllowed(button)).toBe(false);
  });

  it("prevents selection only while drag gesture is active", () => {
    const node = document.createElement("div");
    expect(shouldPreventSelectionDuringDrag(false, node)).toBe(false);
    expect(shouldPreventSelectionDuringDrag(true, node)).toBe(true);
  });

  it("does not prevent selection on interactive elements", () => {
    const input = document.createElement("input");
    expect(shouldPreventSelectionDuringDrag(true, input)).toBe(false);
  });
});

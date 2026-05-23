import { describe, expect, it } from "vitest";
import { formatSetSummary } from "./formatSetSummary";

describe("formatSetSummary", () => {
  it("returns null for empty rows", () => {
    expect(formatSetSummary([])).toBeNull();
  });

  it("returns null when all rows have zero reps", () => {
    expect(
      formatSetSummary([
        { reps: 0, weight: 150 },
        { reps: 0, weight: 130 },
      ])
    ).toBeNull();
  });

  it("formats a single set", () => {
    expect(formatSetSummary([{ reps: 5, weight: 150 }])).toBe("150x5");
  });

  it("merges consecutive sets at the same weight", () => {
    expect(
      formatSetSummary([
        { reps: 5, weight: 150 },
        { reps: 7, weight: 130 },
        { reps: 6, weight: 130 },
        { reps: 5, weight: 130 },
      ])
    ).toBe("150x5, 130x18");
  });

  it("does not merge non-consecutive same-weight runs", () => {
    expect(
      formatSetSummary([
        { reps: 5, weight: 150 },
        { reps: 7, weight: 130 },
        { reps: 5, weight: 150 },
      ])
    ).toBe("150x5, 130x7, 150x5");
  });

  it("skips zero-rep rows while preserving order", () => {
    expect(
      formatSetSummary([
        { reps: 5, weight: 150 },
        { reps: 0, weight: 200 },
        { reps: 7, weight: 130 },
      ])
    ).toBe("150x5, 130x7");
  });

  it("displays decimal weights as stored", () => {
    expect(formatSetSummary([{ reps: 8, weight: 137.5 }])).toBe("137.5x8");
  });
});

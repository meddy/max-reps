import { describe, expect, it } from "vitest";
import { toDatetimeLocalValue } from "./format";

describe("toDatetimeLocalValue", () => {
  it("returns ISO slice 0..16 for a valid Date", () => {
    const d = new Date("2024-06-15T14:30:00.000Z");
    expect(toDatetimeLocalValue(d)).toBe(d.toISOString().slice(0, 16));
  });

  it("matches UTC ISO prefix used by datetime-local inputs", () => {
    const d = new Date(Date.UTC(2023, 0, 2, 8, 5, 0));
    expect(toDatetimeLocalValue(d)).toBe("2023-01-02T08:05");
  });
});

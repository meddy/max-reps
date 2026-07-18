import { describe, expect, it } from "vitest";
import { formatSetEntry, tokensFromSets } from "./formatSetEntry";
import { parseSetEntry } from "./parseSetEntry";

describe("parseSetEntry", () => {
  it("parses bare bodyweight reps", () => {
    const result = parseSetEntry("4,5,6");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sets).toEqual([
      { reps: 4, weight: 0, note: "" },
      { reps: 5, weight: 0, note: "" },
      { reps: 6, weight: 0, note: "" },
    ]);
  });

  it("inherits weight across bare reps", () => {
    const result = parseSetEntry("45x6,7,8");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sets).toEqual([
      { reps: 6, weight: 45, note: "" },
      { reps: 7, weight: 45, note: "" },
      { reps: 8, weight: 45, note: "" },
    ]);
  });

  it("parses mixed weights", () => {
    const result = parseSetEntry("93x10, 65x9");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sets).toEqual([
      { reps: 10, weight: 93, note: "" },
      { reps: 9, weight: 65, note: "" },
    ]);
  });

  it("parses unquoted notes", () => {
    const result = parseSetEntry("9 new technique");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sets).toEqual([
      { reps: 9, weight: 0, note: "new technique" },
    ]);
  });

  it("resets to bodyweight with 0x", () => {
    const result = parseSetEntry("45x6, 0x8,9");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sets).toEqual([
      { reps: 6, weight: 45, note: "" },
      { reps: 8, weight: 0, note: "" },
      { reps: 9, weight: 0, note: "" },
    ]);
  });

  it("parses quoted notes with commas", () => {
    const result = parseSetEntry('9 "new technique, felt good"');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sets).toEqual([
      { reps: 9, weight: 0, note: "new technique, felt good" },
    ]);
  });

  it("accepts decimal weights", () => {
    const result = parseSetEntry("2.25x8, .5x10");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sets).toEqual([
      { reps: 8, weight: 2.25, note: "" },
      { reps: 10, weight: 0.5, note: "" },
    ]);
  });

  it("treats empty input as zero sets", () => {
    expect(parseSetEntry("")).toMatchObject({ ok: true, sets: [] });
    expect(parseSetEntry("   ")).toMatchObject({ ok: true, sets: [] });
  });

  it("reports positional errors for empty tokens", () => {
    const result = parseSetEntry("5,,6");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/empty/i);
    expect(result.error.start).toBeGreaterThanOrEqual(0);
  });

  it("rejects zero reps", () => {
    const result = parseSetEntry("0");
    expect(result.ok).toBe(false);
  });

  it("rejects unclosed quotes", () => {
    const result = parseSetEntry('9 "oops');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/unclosed/i);
  });
});

describe("formatSetEntry", () => {
  it("groups consecutive equal weights", () => {
    expect(
      formatSetEntry([
        { reps: 6, weight: 45, note: "" },
        { reps: 7, weight: 45, note: "" },
        { reps: 8, weight: 45, note: "" },
      ])
    ).toBe("45x6, 7, 8");
  });

  it("emits 0x when returning to bodyweight", () => {
    expect(
      formatSetEntry([
        { reps: 6, weight: 45, note: "" },
        { reps: 8, weight: 0, note: "" },
        { reps: 9, weight: 0, note: "" },
      ])
    ).toBe("45x6, 0x8, 9");
  });

  it("quotes notes that contain commas", () => {
    expect(formatSetEntry([{ reps: 9, weight: 0, note: "a, b" }])).toBe(
      '9 "a, b"'
    );
  });

  it("round-trips through parse", () => {
    const sets = [
      { reps: 10, weight: 93, note: "" },
      { reps: 9, weight: 65, note: "felt heavy" },
      { reps: 8, weight: 0, note: "a, b" },
    ];
    const text = formatSetEntry(sets);
    const parsed = parseSetEntry(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.sets).toEqual(sets);
  });

  it("does not canonicalize unrelated spacing on parse alone", () => {
    const raw = "45x6,7,8";
    const parsed = parseSetEntry(raw);
    expect(parsed.ok).toBe(true);
    // Caller must keep raw; formatter is only for later reconstruction.
    expect(formatSetEntry(parsed.ok ? parsed.sets : [])).toBe("45x6, 7, 8");
    expect(raw).toBe("45x6,7,8");
  });
});

describe("tokensFromSets", () => {
  it("emits weight/reps/note tokens", () => {
    const tokens = tokensFromSets([
      { reps: 6, weight: 45, note: "easy" },
      { reps: 7, weight: 45, note: "" },
    ]);
    expect(tokens.some((t) => t.kind === "weight")).toBe(true);
    expect(tokens.some((t) => t.kind === "reps")).toBe(true);
    expect(tokens.some((t) => t.kind === "note")).toBe(true);
  });
});

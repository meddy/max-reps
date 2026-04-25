import { describe, expect, it } from "vitest";
import { searchExercises } from "./exerciseSearch";

const ts = new Date("2024-01-01T00:00:00Z");

function ex(id: string, displayName: string) {
  return {
    id,
    displayName,
    nameLower: displayName.toLowerCase(),
    createdAt: ts,
    updatedAt: ts,
  };
}

describe("searchExercises", () => {
  it("returns empty list for empty query", () => {
    expect(searchExercises([ex("1", "Bench Press")], "")).toEqual([]);
  });

  it("ranks exact, prefix, token-prefix, then substring matches", () => {
    const results = searchExercises(
      [
        ex("a", "Bench"),
        ex("b", "Bench Press"),
        ex("c", "Incline Bench"),
        ex("d", "Dumbbell Bench Press"),
      ],
      "bench"
    );
    expect(results.map((r) => r.displayName)).toEqual([
      "Bench",
      "Bench Press",
      "Dumbbell Bench Press",
      "Incline Bench",
    ]);
  });

  it("supports multi-token prefix matching across words", () => {
    const results = searchExercises(
      [
        ex("a", "Dumbbell Bench Press"),
        ex("b", "Bench Press"),
        ex("c", "Curl"),
      ],
      "d b"
    );
    expect(results.map((r) => r.displayName)).toEqual(["Dumbbell Bench Press"]);
  });

  it("uses nameLower as tie breaker within same rank", () => {
    const results = searchExercises(
      [ex("a", "Beta Lift"), ex("b", "Alpha Lift")],
      "lift"
    );
    expect(results.map((r) => r.displayName)).toEqual([
      "Alpha Lift",
      "Beta Lift",
    ]);
  });
});

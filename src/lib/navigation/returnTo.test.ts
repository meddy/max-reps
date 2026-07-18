import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAY_RETURN_TO,
  DEFAULT_EXERCISE_RETURN_TO,
  readReturnTo,
} from "./returnTo";

describe("readReturnTo", () => {
  it("returns the exercise default when state is missing or invalid", () => {
    expect(readReturnTo(undefined)).toEqual(DEFAULT_EXERCISE_RETURN_TO);
    expect(readReturnTo(null)).toEqual(DEFAULT_EXERCISE_RETURN_TO);
    expect(readReturnTo({})).toEqual(DEFAULT_EXERCISE_RETURN_TO);
    expect(readReturnTo({ returnTo: { to: "/workouts" } })).toEqual(
      DEFAULT_EXERCISE_RETURN_TO
    );
    expect(readReturnTo({ returnTo: { label: "Back to Workouts" } })).toEqual(
      DEFAULT_EXERCISE_RETURN_TO
    );
  });

  it("returns the provided default when state is missing", () => {
    expect(readReturnTo(undefined, DEFAULT_DAY_RETURN_TO)).toEqual(
      DEFAULT_DAY_RETURN_TO
    );
    expect(readReturnTo({}, DEFAULT_DAY_RETURN_TO)).toEqual(
      DEFAULT_DAY_RETURN_TO
    );
  });

  it("reads a valid returnTo from location state", () => {
    expect(
      readReturnTo({
        returnTo: { to: "/workouts", label: "Back to Workouts" },
      })
    ).toEqual({ to: "/workouts", label: "Back to Workouts" });
    expect(
      readReturnTo(
        {
          returnTo: { to: "/workouts", label: "Back to Workouts" },
        },
        DEFAULT_DAY_RETURN_TO
      )
    ).toEqual({ to: "/workouts", label: "Back to Workouts" });
  });
});

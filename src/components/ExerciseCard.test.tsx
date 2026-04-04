import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { ExerciseCard } from "./ExerciseCard";

describe("ExerciseCard", () => {
  it("links to exercise detail when exerciseId is set", () => {
    renderWithProviders(
      <ExerciseCard
        exerciseName="Squat"
        exerciseId="ex-1"
        onRemove={vi.fn()}
        onAddSet={vi.fn()}
      >
        <p>Child block</p>
      </ExerciseCard>,
      { route: "/workouts" }
    );
    expect(screen.getByRole("link", { name: /squat/i })).toHaveAttribute(
      "href",
      "/exercises/ex-1"
    );
    expect(screen.getByText("Child block")).toBeInTheDocument();
  });
});

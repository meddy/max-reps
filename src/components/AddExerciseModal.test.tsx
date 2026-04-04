import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { AddExerciseModal } from "./AddExerciseModal";

describe("AddExerciseModal", () => {
  it("shows picker when open", () => {
    renderWithProviders(
      <AddExerciseModal open onClose={vi.fn()} onAdd={vi.fn()} />
    );
    expect(
      screen.getByRole("heading", { name: /add exercise to workout/i })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/search exercises/i)
    ).toBeInTheDocument();
  });
});

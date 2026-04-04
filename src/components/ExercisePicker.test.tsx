import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { ExercisePicker } from "./ExercisePicker";

describe("ExercisePicker", () => {
  it("renders search field when active", () => {
    renderWithProviders(
      <ExercisePicker
        active
        flow="staged"
        onCommit={vi.fn()}
        searchPlaceholder="Find lift"
      />
    );
    expect(screen.getByPlaceholderText("Find lift")).toBeInTheDocument();
  });
});

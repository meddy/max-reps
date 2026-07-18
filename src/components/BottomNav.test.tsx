import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { BottomNav } from "./BottomNav";

describe("BottomNav", () => {
  it("exposes primary section links", () => {
    renderWithProviders(<BottomNav />, { route: "/workouts" });
    const nav = screen.getByRole("navigation", { name: /main/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /workouts/i })).toHaveAttribute(
      "href",
      "/workouts"
    );
    expect(screen.getByRole("link", { name: /exercises/i })).toHaveAttribute(
      "href",
      "/exercises"
    );
    expect(screen.getByRole("link", { name: /days/i })).toHaveAttribute(
      "href",
      "/days"
    );
  });
});

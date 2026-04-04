import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { User } from "firebase/auth";
import { renderWithProviders } from "../test/renderWithProviders";
import { Layout } from "./Layout";

const authValue = {
  user: { uid: "u1" } as User,
  loading: false,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  clearError: () => {},
};

describe("Layout", () => {
  it("renders settings link and main heading", () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="workouts" element={<p>Page body</p>} />
        </Route>
      </Routes>,
      { route: "/workouts", authValue }
    );
    expect(
      screen.getByRole("heading", { name: /max reps/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/settings"
    );
    expect(screen.getByText("Page body")).toBeInTheDocument();
  });
});

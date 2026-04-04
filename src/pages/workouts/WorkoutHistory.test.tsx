import { screen, waitFor } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { mockDataAccess } from "../../test/mockDataAccess";
import { renderWithProviders } from "../../test/renderWithProviders";
import { WorkoutHistory } from "./WorkoutHistory";

describe("WorkoutHistory", () => {
  it("shows empty state when there are no workouts", async () => {
    mockDataAccess.workouts.listWithStats.mockResolvedValue([]);
    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue: {
        user: { uid: "u1" } as import("firebase/auth").User,
        loading: false,
        error: null,
        signIn: async () => {},
        signOut: async () => {},
        clearError: () => {},
      },
    });
    await waitFor(() => {
      expect(screen.getByText("No workouts yet")).toBeInTheDocument();
    });
  });

  it("renders workout rows from data access", async () => {
    const ts = Timestamp.fromDate(new Date("2024-01-10T12:00:00"));
    const base = Timestamp.fromDate(new Date("2024-01-01T12:00:00"));
    mockDataAccess.workouts.listWithStats.mockResolvedValue([
      {
        id: "w1",
        date: ts,
        dayId: "d1",
        dayNameSnapshot: "Push Day",
        note: "",
        createdAt: base,
        updatedAt: base,
        setCount: 3,
        exerciseCount: 2,
        totalLoad: 1000,
      },
    ]);
    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue: {
        user: { uid: "u1" } as import("firebase/auth").User,
        loading: false,
        error: null,
        signIn: async () => {},
        signOut: async () => {},
        clearError: () => {},
      },
    });
    await waitFor(() => {
      expect(screen.getByText(/Push Day/)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /Push Day/i })).toHaveAttribute(
      "href",
      "/workouts/w1"
    );
  });
});

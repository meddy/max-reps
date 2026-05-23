import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { mockDataAccess } from "../../test/mockDataAccess";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ExerciseDetail } from "./ExerciseDetail";

const authValue = {
  user: { uid: "u1" } as import("firebase/auth").User,
  loading: false,
  error: null,
  allowedUid: undefined,
  signIn: async () => {},
  signOut: async () => {},
  clearError: () => {},
};

describe("ExerciseDetail", () => {
  it("shows not found when exercise is missing", async () => {
    mockDataAccess.exercises.get.mockResolvedValue(null);
    renderWithProviders(
      <Routes>
        <Route path="/exercises/:id" element={<ExerciseDetail />} />
      </Routes>,
      { route: "/exercises/missing", authValue }
    );
    await waitFor(() => {
      expect(screen.getByText("Exercise not found.")).toBeInTheDocument();
    });
  });

  it("shows error and retries when load fails", async () => {
    mockDataAccess.exercises.get.mockRejectedValue(
      new Error("Firestore read timed out")
    );
    renderWithProviders(
      <Routes>
        <Route path="/exercises/:id" element={<ExerciseDetail />} />
      </Routes>,
      { route: "/exercises/e1", authValue }
    );
    await waitFor(() => {
      expect(screen.getByText("Could not load exercise.")).toBeInTheDocument();
      expect(screen.getByText("Firestore read timed out")).toBeInTheDocument();
    });

    mockDataAccess.exercises.get.mockResolvedValue({
      id: "e1",
      nameLower: "bench",
      displayName: "Bench",
    });
    mockDataAccess.sets.listForExercise.mockResolvedValue([]);
    mockDataAccess.sets.prForExercise.mockResolvedValue(null);
    mockDataAccess.workouts.getNotesByWorkoutIds.mockResolvedValue({});

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByText("Bench")).toBeInTheDocument();
    });
  });
});

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

function renderExerciseDetail(route: string, locationState?: unknown) {
  return renderWithProviders(
    <Routes>
      <Route path="/exercises/:id" element={<ExerciseDetail />} />
      <Route path="/workouts" element={<div>Workouts page</div>} />
      <Route path="/days/:id" element={<div>Day page</div>} />
      <Route path="/exercises" element={<div>Exercises page</div>} />
    </Routes>,
    { route, locationState, authValue }
  );
}

describe("ExerciseDetail", () => {
  it("shows not found when exercise is missing", async () => {
    mockDataAccess.exercises.get.mockResolvedValue(null);
    renderExerciseDetail("/exercises/missing");
    await waitFor(() => {
      expect(screen.getByText("Exercise not found.")).toBeInTheDocument();
    });
  });

  it("shows error and retries when load fails", async () => {
    mockDataAccess.exercises.get.mockRejectedValue(
      new Error("Firestore read timed out")
    );
    renderExerciseDetail("/exercises/e1");
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

  it("defaults back navigation to Exercises when location state is absent", async () => {
    mockDataAccess.exercises.get.mockResolvedValue({
      id: "e1",
      nameLower: "bench",
      displayName: "Bench",
    });
    mockDataAccess.sets.listForExercise.mockResolvedValue([]);
    mockDataAccess.sets.prForExercise.mockResolvedValue(null);
    mockDataAccess.workouts.getNotesByWorkoutIds.mockResolvedValue({});

    renderExerciseDetail("/exercises/e1");

    await waitFor(() => {
      expect(screen.getByText("Bench")).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Back to Exercises" })
    );
    expect(screen.getByText("Exercises page")).toBeInTheDocument();
  });

  it("returns to Workouts when location state says so", async () => {
    mockDataAccess.exercises.get.mockResolvedValue({
      id: "e1",
      nameLower: "bench",
      displayName: "Bench",
    });
    mockDataAccess.sets.listForExercise.mockResolvedValue([]);
    mockDataAccess.sets.prForExercise.mockResolvedValue(null);
    mockDataAccess.workouts.getNotesByWorkoutIds.mockResolvedValue({});

    renderExerciseDetail("/exercises/e1", {
      returnTo: { to: "/workouts", label: "Back to Workouts" },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Back to Workouts" })
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Back to Workouts" })
    );
    expect(screen.getByText("Workouts page")).toBeInTheDocument();
  });

  it("returns to the originating Day when location state says so", async () => {
    mockDataAccess.exercises.get.mockResolvedValue(null);

    renderExerciseDetail("/exercises/missing", {
      returnTo: { to: "/days/d1", label: "Back to Days" },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Back to Days" })
      ).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Back to Days" }));
    expect(screen.getByText("Day page")).toBeInTheDocument();
  });
});

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { mockDataAccess } from "../../test/mockDataAccess";
import { renderWithProviders } from "../../test/renderWithProviders";
import { WorkoutDetail } from "./WorkoutDetail";

const authValue = {
  user: { uid: "u1" } as import("firebase/auth").User,
  loading: false,
  error: null,
  allowedUid: undefined,
  signIn: async () => {},
  signOut: async () => {},
  clearError: () => {},
};

describe("WorkoutDetail", () => {
  it("shows not found when workout is missing", async () => {
    mockDataAccess.workouts.get.mockResolvedValue(null);
    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetail />} />
      </Routes>,
      { route: "/workouts/missing", authValue }
    );
    await waitFor(() => {
      expect(screen.getByText("Workout not found.")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /back to history/i })
    ).toBeInTheDocument();
  });

  it("shows workout header when loaded with sets", async () => {
    const ts = new Date("2024-02-01T12:00:00");
    const base = new Date("2024-01-01T12:00:00");
    mockDataAccess.workouts.get.mockResolvedValue({
      id: "w1",
      date: ts,
      dayId: "d1",
      dayNameSnapshot: "Leg Day",
      note: "",
      createdAt: base,
      updatedAt: base,
    });
    mockDataAccess.sets.listForWorkout.mockResolvedValue([
      {
        id: "s1",
        workoutId: "w1",
        exerciseId: "e1",
        exerciseNameSnapshot: "Squat",
        reps: 5,
        weight: 315,
        unit: "lbs",
        note: "",
        performedAt: ts,
        order: 0,
        createdAt: base,
      },
    ]);
    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetail />} />
      </Routes>,
      { route: "/workouts/w1", authValue }
    );
    await waitFor(() => {
      expect(screen.getByText("Leg Day")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /delete workout/i })
    ).toBeInTheDocument();
  });

  it("persists note on blur via workoutSession.updateWorkout", async () => {
    const user = userEvent.setup();
    const ts = new Date("2024-02-01T12:00:00");
    const base = new Date("2024-01-01T12:00:00");
    mockDataAccess.workouts.get.mockResolvedValue({
      id: "w1",
      date: ts,
      dayId: "d1",
      dayNameSnapshot: "Leg Day",
      note: "",
      createdAt: base,
      updatedAt: base,
    });
    mockDataAccess.sets.listForWorkout.mockResolvedValue([
      {
        id: "s1",
        workoutId: "w1",
        exerciseId: "e1",
        exerciseNameSnapshot: "Squat",
        reps: 5,
        weight: 315,
        unit: "lbs",
        note: "",
        performedAt: ts,
        order: 0,
        createdAt: base,
      },
    ]);
    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetail />} />
      </Routes>,
      { route: "/workouts/w1", authValue }
    );
    await waitFor(() => {
      expect(
        screen.getAllByPlaceholderText(/add a note/i).length
      ).toBeGreaterThan(0);
    });
    const [workoutNoteInput] = screen.getAllByPlaceholderText(/add a note/i);
    await user.clear(workoutNoteInput);
    await user.type(workoutNoteInput, "Leg focus");
    await user.tab();
    await waitFor(() => {
      expect(mockDataAccess.workoutSession.updateWorkout).toHaveBeenCalledWith(
        "w1",
        { note: "Leg focus" }
      );
    });
  });

  it("renders template mode when the workout has no sets but has templates", async () => {
    const ts = new Date("2024-02-01T12:00:00");
    const base = new Date("2024-01-01T12:00:00");
    mockDataAccess.workouts.get.mockResolvedValue({
      id: "w1",
      date: ts,
      dayId: "d1",
      dayNameSnapshot: "Leg Day",
      note: "",
      createdAt: base,
      updatedAt: base,
    });
    mockDataAccess.sets.listForWorkout.mockResolvedValue([]);
    mockDataAccess.templates.listForDayWithExerciseNames.mockResolvedValue([
      {
        id: "t1",
        dayId: "d1",
        exerciseId: "e1",
        numSets: 3,
        repsLower: 8,
        repsUpper: 12,
        order: 0,
        createdAt: base,
        updatedAt: base,
        exerciseDisplayName: "Squat",
      },
    ]);
    mockDataAccess.sets.lastPerformedGroupForExercise.mockResolvedValue({
      sets: [],
    });
    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetail />} />
      </Routes>,
      { route: "/workouts/w1", authValue }
    );
    await waitFor(() => {
      expect(screen.getByText("Squat")).toBeInTheDocument();
    });
    expect(screen.getByText(/target:/i)).toBeInTheDocument();
  });
});

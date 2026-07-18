import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import {
  mockDataAccess,
  resetDataAccessMocks,
} from "../../test/mockDataAccess";
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

function renderDetail(id = "w1") {
  return renderWithProviders(
    <Routes>
      <Route path="/workouts/:id" element={<WorkoutDetail />} />
      <Route path="/workouts" element={<div>Workouts list</div>} />
    </Routes>,
    { route: `/workouts/${id}`, authValue }
  );
}

describe("WorkoutDetail (single-card Workouts page)", () => {
  afterEach(() => {
    resetDataAccessMocks();
  });

  it("loads a single workout with sets", async () => {
    const date = new Date("2024-02-01T12:00:00");
    mockDataAccess.workouts.getWithSets.mockResolvedValue({
      workout: {
        id: "w1",
        date,
        dayId: "d1",
        dayNameSnapshot: "Push",
        note: "pump",
        createdAt: date,
        updatedAt: date,
      },
      sets: [
        {
          id: "s1",
          workoutId: "w1",
          exerciseId: "e1",
          exerciseNameSnapshot: "Bench",
          reps: 5,
          weight: 100,
          unit: "lbs",
          note: "",
          performedAt: date,
          order: 0,
          createdAt: date,
        },
      ],
    });
    mockDataAccess.resolveExerciseNames.mockResolvedValue(
      new Map([["e1", "Bench"]])
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByText("Push")).toBeInTheDocument();
    });
    expect(screen.getByText(/pump/)).toBeInTheDocument();
    expect(screen.getByText("Bench")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /← workouts/i })).toHaveAttribute(
      "href",
      "/workouts"
    );
  });

  it("shows not found error when workout missing", async () => {
    mockDataAccess.workouts.getWithSets.mockResolvedValue(null);
    renderDetail("missing");
    await waitFor(() => {
      expect(screen.getByText(/couldn't load workouts/i)).toBeInTheDocument();
    });
  });

  it("deletes Unlogged workouts from the menu without confirm", async () => {
    const user = userEvent.setup();
    const date = new Date("2024-02-01T12:00:00");
    mockDataAccess.workouts.getWithSets.mockResolvedValue({
      workout: {
        id: "w1",
        date,
        dayId: "",
        dayNameSnapshot: "Custom",
        note: "",
        createdAt: date,
        updatedAt: date,
      },
      sets: [],
    });
    mockDataAccess.workouts.deleteWithSets.mockResolvedValue(undefined);

    renderDetail();
    await waitFor(() => {
      expect(screen.getByLabelText(/workout options/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/workout options/i));
    await user.click(screen.getByRole("menuitem", { name: /^delete$/i }));
    await waitFor(() => {
      expect(mockDataAccess.workouts.deleteWithSets).toHaveBeenCalledWith("w1");
      expect(screen.getByText("Workouts list")).toBeInTheDocument();
    });
    expect(screen.queryByText(/delete workout\?/i)).not.toBeInTheDocument();
  });

  it("confirms deletion when the workout has Sets", async () => {
    const user = userEvent.setup();
    const date = new Date("2024-02-01T12:00:00");
    mockDataAccess.workouts.getWithSets.mockResolvedValue({
      workout: {
        id: "w1",
        date,
        dayId: "",
        dayNameSnapshot: "Custom",
        note: "",
        createdAt: date,
        updatedAt: date,
      },
      sets: [
        {
          id: "s1",
          workoutId: "w1",
          exerciseId: "e1",
          exerciseNameSnapshot: "Bench",
          reps: 5,
          weight: 100,
          unit: "lbs",
          note: "",
          performedAt: date,
          order: 0,
          createdAt: date,
        },
      ],
    });
    mockDataAccess.resolveExerciseNames.mockResolvedValue(
      new Map([["e1", "Bench"]])
    );
    mockDataAccess.workouts.deleteWithSets.mockResolvedValue(undefined);

    renderDetail();
    await waitFor(() => {
      expect(screen.getByLabelText(/workout options/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/workout options/i));
    await user.click(screen.getByRole("menuitem", { name: /^delete$/i }));
    await waitFor(() => {
      expect(screen.getByText(/delete workout\?/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(mockDataAccess.workouts.deleteWithSets).toHaveBeenCalledWith("w1");
      expect(screen.getByText("Workouts list")).toBeInTheDocument();
    });
  });
});

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { formatDate } from "../../lib/format";
import { mockDataAccess } from "../../test/mockDataAccess";
import { renderWithProviders } from "../../test/renderWithProviders";
import {
  buildReorderedExerciseGroups,
  buildWorkoutSetOrderUpdates,
  WorkoutDetail,
} from "./WorkoutDetail";

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

  it("persists note on blur via workoutDetail.updateWorkout", async () => {
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
      expect(mockDataAccess.workoutDetail.updateWorkout).toHaveBeenCalledWith(
        "w1",
        { note: "Leg focus" }
      );
    });
  });

  it("persists date on save via workoutDetail.updateWorkout", async () => {
    const user = userEvent.setup();
    const ts = new Date("2024-02-01T12:00:00");
    const base = new Date("2024-01-01T12:00:00");
    const newDateInput = "2024-06-15T12:00";
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
    await user.click(screen.getByRole("button", { name: formatDate(ts) }));
    const dateInput = screen.getByDisplayValue(ts.toISOString().slice(0, 16));
    await user.clear(dateInput);
    await user.type(dateInput, newDateInput);
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(mockDataAccess.workoutDetail.updateWorkout).toHaveBeenCalledWith(
        "w1",
        { date: new Date(newDateInput) }
      );
    });
  });

  it("renders Unlogged Workout when no sets exist but Set Targets do", async () => {
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

  it("shows Last and Last summary for last performed sets in Unlogged Workout", async () => {
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
      workoutId: "w0",
      sets: [
        { reps: 5, weight: 275 },
        { reps: 3, weight: 275 },
      ],
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

    expect(screen.getByText(/last:/i)).toBeInTheDocument();
    expect(screen.getByText("275x5, 275x3")).toBeInTheDocument();
    expect(screen.queryByText(/lbs/i)).not.toBeInTheDocument();
    expect(screen.getByText(/last summary:/i)).toBeInTheDocument();
    expect(screen.getByText("275x8")).toBeInTheDocument();

    const lastLink = screen.getByRole("link", { name: "275x5, 275x3" });
    expect(lastLink).toHaveAttribute("href", "/workouts/w0");
    expect(screen.getByText("275x8").closest("a")).toBeNull();
  });

  it("Fill from Day merges locally into a logged Workout and shows hybrid metadata", async () => {
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
    mockDataAccess.sets.lastPerformedGroupForExercise.mockImplementation(
      async (exerciseId: string) => {
        if (exerciseId === "e1") {
          return {
            workoutId: "w0",
            sets: [{ reps: 8, weight: 275, note: "slow eccentric" }],
          };
        }
        return { sets: [] };
      }
    );
    mockDataAccess.templates.listForDayWithExerciseNames.mockResolvedValue([
      {
        id: "t1",
        dayId: "d1",
        exerciseId: "e1",
        numSets: 2,
        repsLower: 5,
        repsUpper: 8,
        order: 0,
        createdAt: base,
        updatedAt: base,
        exerciseDisplayName: "Squat",
      },
      {
        id: "t2",
        dayId: "d1",
        exerciseId: "e2",
        numSets: 2,
        repsLower: 8,
        repsUpper: 12,
        order: 1,
        createdAt: base,
        updatedAt: base,
        exerciseDisplayName: "Romanian Deadlift",
      },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetail />} />
      </Routes>,
      { route: "/workouts/w1", authValue }
    );

    const fillButton = await screen.findByRole("button", {
      name: /fill from day/i,
    });
    await waitFor(() => expect(fillButton).toBeEnabled());
    await user.click(fillButton);

    await waitFor(() => {
      expect(screen.getByText("Romanian Deadlift")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/target:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/notes:/i).length).toBeGreaterThan(0);
    expect(mockDataAccess.sets.create).not.toHaveBeenCalled();
  });

  it("disables Fill from Day when the parent Day has no Set Targets", async () => {
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
    mockDataAccess.templates.listForDayWithExerciseNames.mockResolvedValue([]);

    renderWithProviders(
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetail />} />
      </Routes>,
      { route: "/workouts/w1", authValue }
    );

    const fillButton = await screen.findByRole("button", {
      name: /fill from day/i,
    });
    await waitFor(() => expect(fillButton).toBeDisabled());
  });
});

describe("workout reorder helpers", () => {
  it("buildReorderedExerciseGroups reorders by group key", () => {
    const groups = [
      {
        groupKey: "g1",
        exerciseId: "e1",
        exerciseName: "Squat",
        rows: [],
      },
      {
        groupKey: "g2",
        exerciseId: "e2",
        exerciseName: "Bench",
        rows: [],
      },
    ];
    const reordered = buildReorderedExerciseGroups(groups, "g2", "g1");
    expect(reordered?.map((g) => g.groupKey)).toEqual(["g2", "g1"]);
  });

  it("buildWorkoutSetOrderUpdates creates contiguous order for persisted sets", () => {
    const groups = [
      {
        groupKey: "g1",
        exerciseId: "e1",
        exerciseName: "Squat",
        rows: [
          { id: "r1", persistedSetId: "s1", reps: 5, weight: 100, note: "" },
          { id: "r2", reps: 6, weight: 105, note: "" },
        ],
      },
      {
        groupKey: "g2",
        exerciseId: "e2",
        exerciseName: "Bench",
        rows: [
          { id: "r3", persistedSetId: "s3", reps: 5, weight: 200, note: "" },
        ],
      },
    ];
    expect(buildWorkoutSetOrderUpdates(groups)).toEqual([
      { id: "s1", order: 0 },
      { id: "s3", order: 1 },
    ]);
  });
});

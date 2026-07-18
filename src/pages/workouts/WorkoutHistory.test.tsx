import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate } from "../../lib/format";
import { createTestDataAccess } from "../../test/mockDataAccess";
import { renderWithProviders } from "../../test/renderWithProviders";
import { WorkoutHistory } from "./WorkoutHistory";

const authValue = {
  user: { uid: "u1" } as import("firebase/auth").User,
  loading: false,
  error: null,
  allowedUid: undefined,
  signIn: async () => {},
  signOut: async () => {},
  clearError: () => {},
};

function workoutRow(
  overrides: Partial<{
    id: string;
    date: Date;
    dayId: string;
    dayNameSnapshot: string;
    note: string;
  }> = {}
) {
  const base = new Date("2024-01-01T12:00:00");
  return {
    id: "w1",
    date: new Date("2024-01-10T12:00:00"),
    dayId: "d1",
    dayNameSnapshot: "Push Day",
    note: "",
    createdAt: base,
    updatedAt: base,
    ...overrides,
  };
}

describe("WorkoutHistory (inline Workouts page)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when there are no workouts", async () => {
    const dataAccess = createTestDataAccess();
    dataAccess.workouts.listRecentWithSets.mockResolvedValue({
      workouts: [],
      setsByWorkoutId: {},
    });
    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });
    await waitFor(() => {
      expect(screen.getByText("No workouts yet")).toBeInTheDocument();
    });
  });

  it("renders read-only workout cards with sets", async () => {
    const dataAccess = createTestDataAccess();
    const row = workoutRow({ note: "felt strong" });
    dataAccess.workouts.listRecentWithSets.mockResolvedValue({
      workouts: [row],
      setsByWorkoutId: {
        w1: [
          {
            id: "s1",
            workoutId: "w1",
            exerciseId: "e1",
            exerciseNameSnapshot: "Bench",
            reps: 6,
            weight: 45,
            unit: "lbs",
            note: "",
            performedAt: row.date,
            order: 0,
            createdAt: row.date,
          },
          {
            id: "s2",
            workoutId: "w1",
            exerciseId: "e1",
            exerciseNameSnapshot: "Bench",
            reps: 7,
            weight: 45,
            unit: "lbs",
            note: "",
            performedAt: row.date,
            order: 1,
            createdAt: row.date,
          },
        ],
      },
    });
    dataAccess.resolveExerciseNames.mockResolvedValue(
      new Map([["e1", "Bench"]])
    );
    dataAccess.resolveDayExistence.mockResolvedValue(new Map([["d1", true]]));

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByText("Push Day")).toBeInTheDocument();
    });
    expect(screen.getByText(formatDate(row.date))).toBeInTheDocument();
    expect(screen.getByText(/felt strong/)).toBeInTheDocument();
    expect(screen.getByText("Bench")).toBeInTheDocument();
    const dayLink = screen.getByRole("link", { name: "Push Day" });
    expect(dayLink).toHaveAttribute("href", "/days/d1");
    expect(dataAccess.resolveDayExistence).toHaveBeenCalledWith(["d1"]);
    expect(dataAccess.workouts.listRecentWithSets).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 })
    );
  });

  it("does not link Custom Workout titles or missing Days", async () => {
    const dataAccess = createTestDataAccess();
    const custom = workoutRow({
      id: "w_custom",
      dayId: "",
      dayNameSnapshot: "Push Day",
    });
    const dangling = workoutRow({
      id: "w_dangling",
      dayId: "d_gone",
      dayNameSnapshot: "Old Push",
    });
    dataAccess.workouts.listRecentWithSets.mockResolvedValue({
      workouts: [custom, dangling],
      setsByWorkoutId: {},
    });
    dataAccess.resolveDayExistence.mockResolvedValue(
      new Map([["d_gone", false]])
    );

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByText("Push Day")).toBeInTheDocument();
      expect(screen.getByText("Old Push")).toBeInTheDocument();
    });
    expect(screen.queryByRole("link", { name: "Push Day" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Old Push" })).toBeNull();
  });

  it("creates a blank workout and enters edit mode", async () => {
    const user = userEvent.setup();
    const dataAccess = createTestDataAccess();
    dataAccess.workouts.listRecentWithSets.mockResolvedValue({
      workouts: [],
      setsByWorkoutId: {},
    });
    dataAccess.workouts.create.mockResolvedValue("w_new");
    dataAccess.days.list.mockResolvedValue([]);

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create workout/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /create workout/i }));

    await waitFor(() => {
      expect(dataAccess.workouts.create).toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: /^confirm$/i })
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/^title$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Untitled workout")).toBeInTheDocument();
  });

  it("edits Custom Workout title via dayNameSnapshot", async () => {
    const user = userEvent.setup();
    const dataAccess = createTestDataAccess();
    dataAccess.workouts.listRecentWithSets.mockResolvedValue({
      workouts: [],
      setsByWorkoutId: {},
    });
    dataAccess.workouts.create.mockResolvedValue("w_new");
    dataAccess.workouts.update.mockResolvedValue(undefined);
    dataAccess.days.list.mockResolvedValue([]);

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create workout/i })
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /create workout/i }));

    const title = await screen.findByLabelText(/^title$/i);
    await user.clear(title);
    await user.type(title, "Morning pump");

    await waitFor(() => {
      expect(dataAccess.workouts.update).toHaveBeenCalledWith(
        "w_new",
        expect.objectContaining({ dayNameSnapshot: "Morning pump" })
      );
    });
    expect(title).toHaveValue("Morning pump");
  });

  it("shows read-only name when Day-backed, not Title input", async () => {
    const user = userEvent.setup();
    const dataAccess = createTestDataAccess();
    const row = workoutRow();
    dataAccess.workouts.listRecentWithSets.mockResolvedValue({
      workouts: [row],
      setsByWorkoutId: { w1: [] },
    });
    dataAccess.days.list.mockResolvedValue([
      {
        id: "d1",
        displayName: "Push Day",
        nameLower: "push day",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    ]);
    dataAccess.templates.listForDayWithExerciseNames.mockResolvedValue([]);

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/workout options/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/workout options/i));
    await user.click(screen.getByRole("menuitem", { name: /^edit$/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^confirm$/i })
      ).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/^title$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^day$/i)).toHaveValue("d1");
    expect(
      screen.getByText("Push Day", { selector: "div.font-semibold" })
    ).toBeInTheDocument();
  });

  it("overwrites title when selecting a Day after a custom title", async () => {
    const user = userEvent.setup();
    const dataAccess = createTestDataAccess();
    const row = workoutRow({
      dayId: "",
      dayNameSnapshot: "Morning pump",
    });
    dataAccess.workouts.listRecentWithSets.mockResolvedValue({
      workouts: [row],
      setsByWorkoutId: { w1: [] },
    });
    dataAccess.workouts.update.mockResolvedValue(undefined);
    dataAccess.days.list.mockResolvedValue([
      {
        id: "d1",
        displayName: "Push Day",
        nameLower: "push day",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    ]);
    dataAccess.templates.listForDayWithExerciseNames.mockResolvedValue([]);

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/workout options/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/workout options/i));
    await user.click(screen.getByRole("menuitem", { name: /^edit$/i }));

    const title = await screen.findByLabelText(/^title$/i);
    expect(title).toHaveValue("Morning pump");

    await user.selectOptions(screen.getByLabelText(/^day$/i), "d1");

    await waitFor(() => {
      expect(screen.queryByLabelText(/^title$/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^day$/i)).toHaveValue("d1");
    });
    expect(
      screen.getByText("Push Day", { selector: "div.font-semibold" })
    ).toBeInTheDocument();
    expect(dataAccess.workouts.update).toHaveBeenCalledWith(
      "w1",
      expect.objectContaining({
        dayId: "d1",
        dayNameSnapshot: "Push Day",
      })
    );
  });

  it("loads more with page size 10", async () => {
    const user = userEvent.setup();
    const dataAccess = createTestDataAccess();
    const base = new Date("2024-01-01T12:00:00");
    const page1 = Array.from({ length: 10 }, (_, i) =>
      workoutRow({
        id: `w${i}`,
        dayNameSnapshot: `Day ${i}`,
        date: new Date(`2024-06-${String(i + 1).padStart(2, "0")}T12:00:00`),
      })
    );
    dataAccess.workouts.listRecentWithSets
      .mockResolvedValueOnce({
        workouts: page1,
        setsByWorkoutId: Object.fromEntries(page1.map((w) => [w.id, []])),
      })
      .mockResolvedValueOnce({
        workouts: [
          workoutRow({
            id: "w_old",
            dayNameSnapshot: "Older",
            date: base,
          }),
        ],
        setsByWorkoutId: { w_old: [] },
      });

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByText("Day 0")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /load more/i }));
    await waitFor(() => {
      expect(screen.getByText("Older")).toBeInTheDocument();
    });
    expect(dataAccess.workouts.listRecentWithSets).toHaveBeenCalledTimes(2);
  });

  it("opens options menu with edit delete copy", async () => {
    const user = userEvent.setup();
    const dataAccess = createTestDataAccess();
    dataAccess.workouts.listRecentWithSets.mockResolvedValue({
      workouts: [workoutRow()],
      setsByWorkoutId: { w1: [] },
    });
    dataAccess.days.list.mockResolvedValue([]);

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/workout options/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/workout options/i));
    expect(
      screen.getByRole("menuitem", { name: /^edit$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^copy$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^delete$/i })
    ).toBeInTheDocument();
  });

  it("shows Cancel in the editor for Unlogged workouts and deletes without confirm", async () => {
    const user = userEvent.setup();
    const dataAccess = createTestDataAccess();
    dataAccess.workouts.listRecentWithSets.mockResolvedValue({
      workouts: [],
      setsByWorkoutId: {},
    });
    dataAccess.workouts.create.mockResolvedValue("w_new");
    dataAccess.workouts.deleteWithSets.mockResolvedValue(undefined);
    dataAccess.days.list.mockResolvedValue([]);

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create workout/i })
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /create workout/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^cancel$/i })
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /^delete workout$/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      expect(dataAccess.workouts.deleteWithSets).toHaveBeenCalledWith("w_new");
    });
    expect(screen.queryByText(/delete workout\?/i)).not.toBeInTheDocument();
  });

  it("shows Delete workout in the editor when Sets exist and confirms", async () => {
    const user = userEvent.setup();
    const dataAccess = createTestDataAccess();
    const row = workoutRow();
    dataAccess.workouts.listRecentWithSets.mockResolvedValue({
      workouts: [row],
      setsByWorkoutId: {
        w1: [
          {
            id: "s1",
            workoutId: "w1",
            exerciseId: "e1",
            exerciseNameSnapshot: "Bench",
            reps: 6,
            weight: 45,
            unit: "lbs",
            note: "",
            performedAt: row.date,
            order: 0,
            createdAt: row.date,
          },
        ],
      },
    });
    dataAccess.resolveExerciseNames.mockResolvedValue(
      new Map([["e1", "Bench"]])
    );
    dataAccess.days.list.mockResolvedValue([]);
    dataAccess.workouts.deleteWithSets.mockResolvedValue(undefined);

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/workout options/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/workout options/i));
    await user.click(screen.getByRole("menuitem", { name: /^edit$/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^delete workout$/i })
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /^cancel$/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^delete workout$/i }));
    await waitFor(() => {
      expect(screen.getByText(/delete workout\?/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(dataAccess.workouts.deleteWithSets).toHaveBeenCalledWith("w1");
    });
  });
});

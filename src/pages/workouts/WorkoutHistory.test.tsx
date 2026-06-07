import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, afterEach } from "vitest";
import { createTestDataAccess } from "../../test/mockDataAccess";
import { renderWithProviders } from "../../test/renderWithProviders";
import { formatDate } from "../../lib/format";
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

describe("WorkoutHistory", () => {
  it("shows empty state when there are no workouts", async () => {
    const dataAccess = createTestDataAccess();
    dataAccess.workouts.listRecent.mockResolvedValue([]);
    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });
    await waitFor(() => {
      expect(screen.getByText("No workouts yet")).toBeInTheDocument();
    });
  });

  it("renders workout rows from data access", async () => {
    const ts = new Date("2024-01-10T12:00:00");
    const base = new Date("2024-01-01T12:00:00");
    const dataAccess = createTestDataAccess();
    const row = {
      id: "w1",
      date: ts,
      dayId: "d1",
      dayNameSnapshot: "Push Day",
      note: "",
      createdAt: base,
      updatedAt: base,
    };
    dataAccess.workouts.listRecent.mockResolvedValue([row]);
    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });
    await waitFor(() => {
      expect(screen.getByText(/Push Day/)).toBeInTheDocument();
    });
    expect(
      screen.getByText(formatDate(ts, { weekday: true }))
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Push Day/i })).toHaveAttribute(
      "href",
      "/workouts/w1"
    );
    expect(screen.queryByText(/exercises/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Loading stats/)).not.toBeInTheDocument();
  });

  it("loads more workouts with cursor and appends rows", async () => {
    const base = new Date("2024-01-01T12:00:00");
    const page1 = Array.from({ length: 25 }, (_, i) => ({
      id: `w${i}`,
      date: new Date(`2024-06-${String(i + 1).padStart(2, "0")}T12:00:00`),
      dayId: "d1",
      dayNameSnapshot: `Day ${i}`,
      note: "",
      createdAt: base,
      updatedAt: base,
    }));
    const page2Row = {
      id: "w_old",
      date: new Date("2024-01-01T12:00:00"),
      dayId: "d1",
      dayNameSnapshot: "Oldest",
      note: "",
      createdAt: base,
      updatedAt: base,
    };

    const dataAccess = createTestDataAccess();
    dataAccess.workouts.listRecent
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce([page2Row]);

    const user = userEvent.setup();
    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Load more" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => {
      expect(screen.getByText("Oldest")).toBeInTheDocument();
    });

    expect(dataAccess.workouts.listRecent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sort: "desc",
        limit: 25,
        startAfter: { date: page1[24]!.date, id: "w24" },
      })
    );
  });

  it("debounces Day search in Add workout modal", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const dataAccess = createTestDataAccess();
    dataAccess.workouts.listRecent.mockResolvedValue([]);
    dataAccess.days.searchByNamePrefix.mockResolvedValue([
      {
        id: "d1",
        nameLower: "push",
        displayName: "Push",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByText("No workouts yet")).toBeInTheDocument();
    });

    await user.click(screen.getByTitle("Add workout"));
    const search = screen.getByPlaceholderText("Search Days...");

    await user.type(search, "pu");
    expect(dataAccess.days.searchByNamePrefix).not.toHaveBeenCalled();
    expect(screen.queryByText(/No Days match/i)).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => {
      expect(dataAccess.days.searchByNamePrefix).toHaveBeenCalledTimes(1);
    });
    expect(dataAccess.days.searchByNamePrefix).toHaveBeenCalledWith("pu", 20);
  });

  it("shows custom name input when Custom Workout mode is selected", async () => {
    const user = userEvent.setup();
    const dataAccess = createTestDataAccess();
    dataAccess.workouts.listRecent.mockResolvedValue([]);

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByText("No workouts yet")).toBeInTheDocument();
    });

    await user.click(screen.getByTitle("Add workout"));
    expect(screen.getByPlaceholderText("Search Days...")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Custom Workout" }));
    expect(
      screen.queryByPlaceholderText("Search Days...")
    ).not.toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("e.g. Hotel gym, Recovery")
    ).toBeInTheDocument();
  });

  it("creates a Custom Workout with empty dayId and trimmed dayNameSnapshot", async () => {
    const user = userEvent.setup();
    const dataAccess = createTestDataAccess();
    dataAccess.workouts.listRecent.mockResolvedValue([]);
    dataAccess.workouts.create.mockResolvedValue("w-custom");

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByText("No workouts yet")).toBeInTheDocument();
    });

    await user.click(screen.getByTitle("Add workout"));
    await user.click(screen.getByRole("button", { name: "Custom Workout" }));
    await user.type(
      screen.getByPlaceholderText("e.g. Hotel gym, Recovery"),
      "  Hotel gym  "
    );
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(dataAccess.workouts.create).toHaveBeenCalledWith({
        date: expect.any(Date),
        dayId: "",
        dayNameSnapshot: "Hotel gym",
        note: "",
      });
    });
  });

  it("disables Create for Custom Workout when name is whitespace only", async () => {
    const user = userEvent.setup();
    const dataAccess = createTestDataAccess();
    dataAccess.workouts.listRecent.mockResolvedValue([]);

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByText("No workouts yet")).toBeInTheDocument();
    });

    await user.click(screen.getByTitle("Add workout"));
    await user.click(screen.getByRole("button", { name: "Custom Workout" }));
    await user.type(
      screen.getByPlaceholderText("e.g. Hotel gym, Recovery"),
      "   "
    );

    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("restores Day search when switching back to From Day", async () => {
    const user = userEvent.setup();
    const dataAccess = createTestDataAccess();
    dataAccess.workouts.listRecent.mockResolvedValue([]);

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByText("No workouts yet")).toBeInTheDocument();
    });

    await user.click(screen.getByTitle("Add workout"));
    await user.click(screen.getByRole("button", { name: "Custom Workout" }));
    await user.click(screen.getByRole("button", { name: "From Day" }));

    expect(screen.getByPlaceholderText("Search Days...")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("e.g. Hotel gym, Recovery")
    ).not.toBeInTheDocument();
  });

  it("hides Load more when the first page is shorter than PAGE_SIZE", async () => {
    const ts = new Date("2024-01-10T12:00:00");
    const base = new Date("2024-01-01T12:00:00");
    const dataAccess = createTestDataAccess();
    const row = {
      id: "w1",
      date: ts,
      dayId: "d1",
      dayNameSnapshot: "Push Day",
      note: "",
      createdAt: base,
      updatedAt: base,
    };
    dataAccess.workouts.listRecent.mockResolvedValue([row]);

    renderWithProviders(<WorkoutHistory />, {
      route: "/workouts",
      authValue,
      dataAccess,
    });

    await waitFor(() => {
      expect(screen.getByText(/Push Day/)).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Load more" })
    ).not.toBeInTheDocument();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

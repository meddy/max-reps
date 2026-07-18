import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { mockDataAccess } from "../../test/mockDataAccess";
import { renderWithProviders } from "../../test/renderWithProviders";
import { buildTemplateReorderResult, DayDetail } from "./DayDetail";

const authValue = {
  user: { uid: "u1" } as import("firebase/auth").User,
  loading: false,
  error: null,
  allowedUid: undefined,
  signIn: async () => {},
  signOut: async () => {},
  clearError: () => {},
};

describe("DayDetail", () => {
  it("shows not found when day is missing", async () => {
    mockDataAccess.days.get.mockResolvedValue(null);
    renderWithProviders(
      <Routes>
        <Route path="/days/:id" element={<DayDetail />} />
      </Routes>,
      { route: "/days/missing", authValue }
    );
    await waitFor(() => {
      expect(screen.getByText("Day not found.")).toBeInTheDocument();
    });
  });

  it("uses returnTo from location state for the back button", async () => {
    const ts = new Date("2024-02-01T12:00:00.000Z");
    mockDataAccess.days.get.mockResolvedValue({
      id: "d1",
      nameLower: "push",
      displayName: "Push",
      createdAt: ts,
      updatedAt: ts,
    });
    mockDataAccess.templates.listForDayWithExerciseNames.mockResolvedValue([]);

    renderWithProviders(
      <Routes>
        <Route path="/days/:id" element={<DayDetail />} />
      </Routes>,
      {
        route: "/days/d1",
        locationState: {
          returnTo: { to: "/workouts", label: "Back to Workouts" },
        },
        authValue,
      }
    );

    expect(
      await screen.findByRole("button", { name: "Back to Workouts" })
    ).toBeInTheDocument();
  });

  it("uses drag-and-drop with no handle and no move buttons", async () => {
    const ts = new Date("2024-02-01T12:00:00.000Z");
    mockDataAccess.days.get.mockResolvedValue({
      id: "d1",
      nameLower: "push",
      displayName: "Push",
      createdAt: ts,
      updatedAt: ts,
    });
    mockDataAccess.templates.listForDayWithExerciseNames.mockResolvedValue([
      {
        id: "t1",
        dayId: "d1",
        exerciseId: "e1",
        exerciseDisplayName: "Bench Press",
        numSets: 3,
        repsLower: 8,
        repsUpper: 12,
        order: 0,
        createdAt: ts,
        updatedAt: ts,
      },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/days/:id" element={<DayDetail />} />
      </Routes>,
      { route: "/days/d1", authValue }
    );

    expect(await screen.findByText("Bench Press")).toBeInTheDocument();
    expect(screen.queryByTitle("Drag to reorder")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Move up")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Move down")).not.toBeInTheDocument();
  });
});

describe("buildTemplateReorderResult", () => {
  it("returns reordered templates and changed order updates", () => {
    const ts = new Date("2024-02-01T12:00:00.000Z");
    const templates = [
      {
        id: "t1",
        dayId: "d1",
        exerciseId: "e1",
        exerciseDisplayName: "Bench Press",
        numSets: 3,
        repsLower: 8,
        repsUpper: 12,
        order: 0,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: "t2",
        dayId: "d1",
        exerciseId: "e2",
        exerciseDisplayName: "Overhead Press",
        numSets: 3,
        repsLower: 6,
        repsUpper: 10,
        order: 1,
        createdAt: ts,
        updatedAt: ts,
      },
    ];

    const result = buildTemplateReorderResult(templates, "t1", "t2");
    expect(result).not.toBeNull();
    expect(result?.nextTemplates.map((t) => t.id)).toEqual(["t2", "t1"]);
    expect(result?.updates).toEqual([
      { id: "t2", order: 0 },
      { id: "t1", order: 1 },
    ]);
  });

  it("returns null when drag target is unchanged", () => {
    const ts = new Date("2024-02-01T12:00:00.000Z");
    const templates = [
      {
        id: "t1",
        dayId: "d1",
        exerciseId: "e1",
        exerciseDisplayName: "Bench Press",
        numSets: 3,
        repsLower: 8,
        repsUpper: 12,
        order: 0,
        createdAt: ts,
        updatedAt: ts,
      },
    ];

    expect(buildTemplateReorderResult(templates, "t1", "t1")).toBeNull();
  });
});

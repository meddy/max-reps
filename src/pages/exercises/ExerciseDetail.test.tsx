import { screen, waitFor } from "@testing-library/react";
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
});

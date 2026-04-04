import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { mockDataAccess } from "../../test/mockDataAccess";
import { renderWithProviders } from "../../test/renderWithProviders";
import { DayDetail } from "./DayDetail";

const authValue = {
  user: { uid: "u1" } as import("firebase/auth").User,
  loading: false,
  error: null,
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
});

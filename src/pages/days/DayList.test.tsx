import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { DayList } from "./DayList";

const authValue = {
  user: { uid: "u1" } as import("firebase/auth").User,
  loading: false,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  clearError: () => {},
};

describe("DayList", () => {
  it("shows empty state when there are no days", async () => {
    renderWithProviders(<DayList />, { route: "/days", authValue });
    await waitFor(() => {
      expect(screen.getByText("No days")).toBeInTheDocument();
    });
  });
});

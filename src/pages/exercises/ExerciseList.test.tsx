import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ExerciseList } from "./ExerciseList";

const authValue = {
  user: { uid: "u1" } as import("firebase/auth").User,
  loading: false,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  clearError: () => {},
};

describe("ExerciseList", () => {
  it("shows empty state when there are no exercises", async () => {
    renderWithProviders(<ExerciseList />, {
      route: "/exercises",
      authValue,
    });
    await waitFor(() => {
      expect(screen.getByText("No exercises")).toBeInTheDocument();
    });
  });
});

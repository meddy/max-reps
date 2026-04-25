import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockDataAccess } from "../../test/mockDataAccess";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ExerciseList } from "./ExerciseList";

const authValue = {
  user: { uid: "u1" } as import("firebase/auth").User,
  loading: false,
  error: null,
  allowedUid: undefined,
  signIn: async () => {},
  signOut: async () => {},
  clearError: () => {},
};

describe("ExerciseList", () => {
  it("shows empty state when there are no exercises", async () => {
    mockDataAccess.exercises.listAllForSearch.mockResolvedValue([]);
    renderWithProviders(<ExerciseList />, {
      route: "/exercises",
      authValue,
    });
    await waitFor(() => {
      expect(screen.getByText("No exercises")).toBeInTheDocument();
    });
  });

  it("uses fuzzy relevance order while searching regardless of sort toggle", async () => {
    const ts = new Date("2024-01-01T00:00:00.000Z");
    mockDataAccess.exercises.listAllForSearch.mockResolvedValue([
      {
        id: "ex1",
        nameLower: "zeta bench",
        displayName: "Zeta Bench",
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: "ex2",
        nameLower: "bench press",
        displayName: "Bench Press",
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: "ex3",
        nameLower: "alpha curl",
        displayName: "Alpha Curl",
        createdAt: ts,
        updatedAt: ts,
      },
    ]);

    renderWithProviders(<ExerciseList />, {
      route: "/exercises",
      authValue,
    });

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Bench Press" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /sort exercises/i }));
    fireEvent.change(screen.getByPlaceholderText("Search exercises"), {
      target: { value: "bench" },
    });

    await waitFor(() => {
      const bench = screen.getByRole("link", { name: "Bench Press" });
      const zeta = screen.getByRole("link", { name: "Zeta Bench" });
      expect(bench.compareDocumentPosition(zeta)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
  });
});

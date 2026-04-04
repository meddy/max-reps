import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authState } from "./test/authState";

vi.mock("./contexts/AuthContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./contexts/AuthContext")>();
  const { authState: auth } = await import("./test/authState");
  return {
    ...actual,
    AuthProvider({ children }: { children: ReactNode }) {
      return (
        <actual.AuthTestProvider
          value={{
            user: auth.nextUser as import("firebase/auth").User | null,
            loading: false,
            error: null,
            signIn: async () => {},
            signOut: async () => {},
            clearError: () => {},
          }}
        >
          {children}
        </actual.AuthTestProvider>
      );
    },
  };
});

import App from "./App";

describe("App", () => {
  beforeEach(() => {
    authState.nextUser = null;
  });

  it("shows login when signed out", async () => {
    authState.nextUser = null;
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /sign in with google/i })
      ).toBeInTheDocument();
    });
  });

  it("shows workout history shell when signed in", async () => {
    authState.nextUser = { uid: "user-1" };
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("No workouts yet")).toBeInTheDocument();
    });
  });
});

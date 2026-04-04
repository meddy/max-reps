import { screen, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../contexts/AuthContext";
import { renderWithProviders } from "../test/renderWithProviders";
import { ProtectedRoute } from "./ProtectedRoute";

function baseAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    loading: false,
    error: null,
    allowedUid: undefined,
    signIn: vi.fn(),
    signOut: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

const fakeUser = { uid: "u1" } as User;

describe("ProtectedRoute", () => {
  it("shows loading spinner while auth is loading", () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <p>Secret</p>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { authValue: baseAuth({ loading: true }) }
    );
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("redirects unauthenticated users to login", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<p>Login gate</p>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <p>Secret</p>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { route: "/", authValue: baseAuth({ user: null }) }
    );
    await waitFor(() => {
      expect(screen.getByText("Login gate")).toBeInTheDocument();
    });
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <p>Secret</p>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { authValue: baseAuth({ user: fakeUser }) }
    );
    expect(screen.getByText("Secret")).toBeInTheDocument();
  });
});

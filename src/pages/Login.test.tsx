import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { Login } from "./Login";

describe("Login", () => {
  it("renders sign-in when not loading", () => {
    renderWithProviders(<Login />, {
      route: "/login",
      authValue: {
        user: null,
        loading: false,
        error: null,
        signIn: vi.fn(),
        signOut: vi.fn(),
        clearError: vi.fn(),
      },
    });
    expect(
      screen.getByRole("button", { name: /sign in with google/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /max reps/i })
    ).toBeInTheDocument();
  });

  it("calls signIn when button clicked", async () => {
    const signIn = vi.fn();
    renderWithProviders(<Login />, {
      route: "/login",
      authValue: {
        user: null,
        loading: false,
        error: null,
        signIn,
        signOut: vi.fn(),
        clearError: vi.fn(),
      },
    });
    const signInButtons = screen.getAllByRole("button", {
      name: /sign in with google/i,
    });
    fireEvent.click(signInButtons[0]!);
    expect(signIn).toHaveBeenCalledOnce();
  });
});

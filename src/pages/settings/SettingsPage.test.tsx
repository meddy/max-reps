import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

import { SettingsPage } from "./SettingsPage";

const authValue = {
  user: { uid: "u1" } as import("firebase/auth").User,
  loading: false,
  error: null,
  allowedUid: undefined,
  signIn: async () => {},
  signOut: vi.fn(),
  clearError: () => {},
};

describe("SettingsPage", () => {
  it("shows settings sections and sign out", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, {
      route: "/settings",
      authValue,
    });
    expect(
      screen.getByRole("heading", { name: /settings/i })
    ).toBeInTheDocument();
    expect(screen.getByText("u1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /sign out/i }));
    expect(authValue.signOut).toHaveBeenCalledOnce();
  });
});

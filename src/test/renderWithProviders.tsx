import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import {
  AuthTestProvider,
  type AuthContextValue,
} from "../contexts/AuthContext";

export type RenderWithProvidersOptions = Omit<RenderOptions, "wrapper"> & {
  route?: string;
  authValue?: AuthContextValue;
};

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", authValue, ...renderOptions }: RenderWithProvidersOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    const inner = (
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    );
    if (authValue !== undefined) {
      return <AuthTestProvider value={authValue}>{inner}</AuthTestProvider>;
    }
    return inner;
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

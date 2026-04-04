import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import {
  AuthTestProvider,
  type AuthContextValue,
} from "../contexts/AuthContext";
import { DataAccessProvider } from "../contexts/DataAccessContext";
import type { DataAccess } from "../lib/dataAccess";
import { mockDataAccess } from "./mockDataAccess";

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
    const withData = (
      <DataAccessProvider value={mockDataAccess as unknown as DataAccess}>
        {inner}
      </DataAccessProvider>
    );
    if (authValue !== undefined) {
      return <AuthTestProvider value={authValue}>{withData}</AuthTestProvider>;
    }
    return withData;
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

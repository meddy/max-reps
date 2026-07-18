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
  /** Passed as `location.state` for the initial MemoryRouter entry. */
  locationState?: unknown;
  authValue?: AuthContextValue;
  /** When set, uses this instance instead of the global `mockDataAccess`. */
  dataAccess?: DataAccess;
};

export function renderWithProviders(
  ui: ReactElement,
  {
    route = "/",
    locationState,
    authValue,
    dataAccess = mockDataAccess,
    ...renderOptions
  }: RenderWithProvidersOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    const inner = (
      <MemoryRouter
        initialEntries={[
          locationState === undefined
            ? route
            : { pathname: route, state: locationState },
        ]}
      >
        {children}
      </MemoryRouter>
    );
    const withData = (
      <DataAccessProvider value={dataAccess}>{inner}</DataAccessProvider>
    );
    if (authValue !== undefined) {
      return <AuthTestProvider value={authValue}>{withData}</AuthTestProvider>;
    }
    return withData;
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

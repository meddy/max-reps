import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { authState } from "./authState";
import { resetDataAccessMocks } from "./mockDataAccess";
import "./mockFirebaseAuth";

vi.mock("recharts", () => {
  const Passthrough = ({
    children,
  }: {
    children?: React.ReactNode;
  }): React.ReactNode => children ?? null;
  const Stub = ({
    children,
    ...rest
  }: React.ComponentProps<"div"> & { children?: React.ReactNode }) =>
    React.createElement(
      "div",
      { "data-testid": "recharts-stub", ...rest },
      children
    );
  return {
    ResponsiveContainer: Stub,
    LineChart: Passthrough,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Line: () => null,
  };
});

beforeEach(() => {
  authState.nextUser = null;
  resetDataAccessMocks();
});

afterEach(() => {
  cleanup();
});

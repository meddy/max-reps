import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

const RELOAD_TIMESTAMP_KEY = "max-reps:chunk-reload-at";

function Bomb({ message, name }: { message: string; name?: string }): never {
  const err = new Error(message);
  if (name) err.name = name;
  throw err;
}

describe("ErrorBoundary", () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <p>healthy content</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("healthy content")).toBeInTheDocument();
  });

  it("calls location.reload when a chunk-load error is caught for the first time", () => {
    render(
      <ErrorBoundary>
        <Bomb message="Failed to fetch dynamically imported module: /a.js" />
      </ErrorBoundary>
    );

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: /reload/i })
    ).not.toBeInTheDocument();
    const stamp = Number(sessionStorage.getItem(RELOAD_TIMESTAMP_KEY));
    expect(stamp).toBeGreaterThan(0);
  });

  it("renders the fallback if a chunk error fires within 30s of the last reload", () => {
    sessionStorage.setItem(RELOAD_TIMESTAMP_KEY, String(Date.now() - 5_000));

    render(
      <ErrorBoundary>
        <Bomb message="Failed to fetch dynamically imported module: /a.js" />
      </ErrorBoundary>
    );

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it("renders the fallback for non-chunk errors and does not reload", () => {
    render(
      <ErrorBoundary>
        <Bomb message="boom: something unrelated" />
      </ErrorBoundary>
    );

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/boom: something unrelated/)).toBeInTheDocument();
  });

  it("Reload button in the fallback calls location.reload", () => {
    render(
      <ErrorBoundary>
        <Bomb message="boom" />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: /reload/i }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});

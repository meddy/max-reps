import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError } from "../lib/chunkLoadError";

const RELOAD_TIMESTAMP_KEY = "max-reps:chunk-reload-at";
const RELOAD_GUARD_MS = 30_000;

type Props = { children: ReactNode };

type State = { error: Error | null; willReload: boolean };

function readLastReloadAt(): number {
  try {
    const raw = sessionStorage.getItem(RELOAD_TIMESTAMP_KEY);
    if (raw == null) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeLastReloadAt(now: number): void {
  try {
    sessionStorage.setItem(RELOAD_TIMESTAMP_KEY, String(now));
  } catch {
    /* ignore */
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, willReload: false };

  static getDerivedStateFromError(error: Error): State {
    if (isChunkLoadError(error)) {
      const lastReloadAt = readLastReloadAt();
      const sinceReload = Date.now() - lastReloadAt;
      if (sinceReload > RELOAD_GUARD_MS) {
        return { error, willReload: true };
      }
    }
    return { error, willReload: false };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    console.error("[max-reps]", error);
    if (this.state.willReload) {
      writeLastReloadAt(Date.now());
      window.location.reload();
    }
  }

  private handleReloadClick = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error == null) return this.props.children;

    if (this.state.willReload) {
      // Reload is in flight; avoid flashing the fallback during the brief gap.
      return <div aria-hidden />;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">
            Something went wrong
          </h2>
          <p className="mt-3 break-words font-mono text-xs text-gray-500">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={this.handleReloadClick}
            className="mt-5 min-h-[44px] w-full rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

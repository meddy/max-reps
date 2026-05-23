import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  AuthTestProvider,
  type AuthContextValue,
} from "../contexts/AuthContext";
import { useRemoteLoad } from "./useRemoteLoad";

const authedUser = {
  uid: "test-user",
  getIdToken: vi.fn().mockResolvedValue("token"),
} as unknown as import("firebase/auth").User;

const authValue: AuthContextValue = {
  user: authedUser,
  loading: false,
  error: null,
  allowedUid: "test-user",
  signIn: async () => {},
  signOut: async () => {},
  clearError: () => {},
};

function renderRemoteLoad(
  options: Parameters<typeof useRemoteLoad>[0],
  auth: AuthContextValue = authValue
) {
  return renderHook(() => useRemoteLoad(options), {
    wrapper: ({ children }) => (
      <AuthTestProvider value={auth}>{children}</AuthTestProvider>
    ),
  });
}

describe("useRemoteLoad", () => {
  beforeEach(() => {
    authedUser.getIdToken = vi.fn().mockResolvedValue("token");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  it("does not run load when auth is loading", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    renderRemoteLoad({ load }, { ...authValue, user: null, loading: true });
    await waitFor(() => {
      expect(load).not.toHaveBeenCalled();
    });
  });

  it("runs load when enabled and sets loading false on success", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const { result } = renderRemoteLoad({ load });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(
      expect.objectContaining({ background: false })
    );
    expect(result.current.loadError).toBeNull();
    expect(authedUser.getIdToken).toHaveBeenCalledWith(true);
  });

  it("sets loadError on foreground failure", async () => {
    const load = vi.fn().mockRejectedValue(new Error("Firestore timed out"));
    const { result } = renderRemoteLoad({ load });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe("Firestore timed out");
  });

  it("suppresses loadError on background failure", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("background fail"));
    const hasData = vi.fn().mockReturnValue(true);
    const { result } = renderRemoteLoad({ load, hasData });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBeNull();

    await act(async () => {
      await result.current.reload({ background: true });
    });
    expect(result.current.loadError).toBeNull();
  });

  it("deduplicates concurrent reload calls", async () => {
    let resolveLoad!: () => void;
    const load = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        })
    );
    const { result } = renderRemoteLoad({ load, enabled: false });

    await waitFor(() => expect(result.current.loading).toBe(false));

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    await act(async () => {
      p1 = result.current.reload();
      p2 = result.current.reload();
    });
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLoad();
      await Promise.all([p1, p2]);
    });
  });

  it("re-runs load when deps change", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ dep }) =>
        useRemoteLoad({
          load,
          deps: [dep],
        }),
      {
        initialProps: { dep: 1 },
        wrapper: ({ children }) => (
          <AuthTestProvider value={authValue}>{children}</AuthTestProvider>
        ),
      }
    );

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    rerender({ dep: 2 });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  describe("visibility refetch", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("refetches when refetchOnVisibility is true and data is stale", async () => {
      const load = vi.fn().mockResolvedValue(undefined);
      renderRemoteLoad({
        load,
        refetchOnVisibility: true,
        hasData: () => true,
      });

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(load).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_001);
        document.dispatchEvent(new Event("visibilitychange"));
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(load).toHaveBeenCalledTimes(2);
      expect(load).toHaveBeenLastCalledWith(
        expect.objectContaining({ background: true })
      );
    });

    it("skips refetch when data is still fresh", async () => {
      const load = vi.fn().mockResolvedValue(undefined);
      renderRemoteLoad({
        load,
        refetchOnVisibility: true,
        hasData: () => true,
      });

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(load).toHaveBeenCalledTimes(1);

      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(load).toHaveBeenCalledTimes(1);
    });
  });
});

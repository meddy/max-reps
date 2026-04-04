import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import type { Auth, User } from "firebase/auth";
import * as firebaseAuth from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { authState } from "../test/authState";

/** Matches `src/test/mockFirebaseAuth.ts` — restored after each test in this file. */
function defaultOnAuthStateChanged(
  _auth: Auth,
  cb: (user: User | null) => void
): () => void {
  const u = authState.nextUser;
  queueMicrotask(() => {
    cb(u as User | null);
  });
  return () => {};
}

/**
 * Unsubscribe cancels a pending microtask callback. Under Strict Mode the first
 * subscription is torn down before the microtask runs; a second mount must attach
 * again and still deliver auth so `useSyncExternalStore` is notified (regression
 * guard for constructor-time Firebase subscribe + effect dispose).
 */
function strictModeOnAuthStateChanged(
  _auth: Auth,
  cb: (user: User | null) => void
): () => void {
  let active = true;
  queueMicrotask(() => {
    if (active) {
      cb(authState.nextUser as User | null);
    }
  });
  return () => {
    active = false;
  };
}

function AuthProbe() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div aria-busy="true">auth-loading</div>;
  }
  if (user) {
    return <div>authed</div>;
  }
  return <div>signed-out</div>;
}

describe("AuthProvider + StrictMode (Firebase listener lifecycle)", () => {
  beforeEach(() => {
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation(
      strictModeOnAuthStateChanged as typeof firebaseAuth.onAuthStateChanged
    );
  });

  afterEach(() => {
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation(
      defaultOnAuthStateChanged as typeof firebaseAuth.onAuthStateChanged
    );
  });

  it("leaves auth loading=false after Strict Mode remount when auth resolves async", async () => {
    const allowed = import.meta.env.VITE_ALLOWED_UID as string | undefined;
    authState.nextUser = {
      uid: allowed && allowed.length > 0 ? allowed : "strict-mode-test-user",
    } as User;

    render(
      <StrictMode>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </StrictMode>
    );

    await waitFor(() => {
      expect(screen.getByText("authed")).toBeInTheDocument();
    });
    expect(screen.queryByText("auth-loading")).not.toBeInTheDocument();
  });
});

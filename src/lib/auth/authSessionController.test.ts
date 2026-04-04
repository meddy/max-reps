import { describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { AuthSessionController } from "./authSessionController";

function fakeUser(uid: string): User {
  return { uid } as User;
}

describe("AuthSessionController", () => {
  it("allows user when uid matches allowedUid", () => {
    let listener: ((user: User | null) => void) | null = null;
    const port = {
      onAuthStateChanged: vi.fn((cb: (user: User | null) => void) => {
        listener = cb;
        return () => {};
      }),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    };
    const c = new AuthSessionController(port, "u1");
    c.attachAuthListener();
    listener!(fakeUser("u1"));
    expect(c.getSnapshot().user?.uid).toBe("u1");
    expect(c.getSnapshot().error).toBeNull();
    expect(c.getSnapshot().loading).toBe(false);
    c.dispose();
  });

  it("denies and signs out when uid does not match", () => {
    let listener: ((user: User | null) => void) | null = null;
    const port = {
      onAuthStateChanged: vi.fn((cb: (user: User | null) => void) => {
        listener = cb;
        return () => {};
      }),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    const c = new AuthSessionController(port, "u1");
    c.attachAuthListener();
    listener!(fakeUser("other"));
    expect(c.getSnapshot().user).toBeNull();
    expect(c.getSnapshot().error).toBe("Access denied");
    expect(port.signOut).toHaveBeenCalled();
    c.dispose();
  });

  it("signed_out clears user", () => {
    let listener: ((user: User | null) => void) | null = null;
    const port = {
      onAuthStateChanged: vi.fn((cb: (user: User | null) => void) => {
        listener = cb;
        return () => {};
      }),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    };
    const c = new AuthSessionController(port, "u1");
    c.attachAuthListener();
    listener!(null);
    expect(c.getSnapshot().user).toBeNull();
    expect(c.getSnapshot().loading).toBe(false);
    c.dispose();
  });

  it("signIn records popup errors on the port", async () => {
    const port = {
      onAuthStateChanged: vi.fn(() => () => {}),
      signInWithGoogle: vi.fn().mockRejectedValue(new Error("popup blocked")),
      signOut: vi.fn(),
    };
    const c = new AuthSessionController(port, "u1");
    c.attachAuthListener();
    await c.signIn();
    expect(c.getSnapshot().error).toBe("popup blocked");
    c.dispose();
  });
});

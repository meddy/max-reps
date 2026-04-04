import { vi } from "vitest";
import { authState } from "./authState";

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {
    return {};
  }),
  onAuthStateChanged: vi.fn((_auth: unknown, cb: (u: unknown) => void) => {
    const u = authState.nextUser;
    queueMicrotask(() => cb(u));
    return () => {};
  }),
  signInWithPopup: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
}));

vi.mock("../lib/firebase", () => ({
  auth: {},
  db: {},
}));

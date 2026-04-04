import type { User } from "firebase/auth";

/** Testable boundary around Firebase Auth used by {@link AuthSessionController}. */
export interface AuthClientPort {
  onAuthStateChanged(callback: (user: User | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

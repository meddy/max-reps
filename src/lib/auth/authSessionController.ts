import type { User } from "firebase/auth";
import { evaluateUidAccess } from "../authPolicy";
import type { AuthClientPort } from "./authClientPort";

export type AuthViewState = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

/**
 * Owns auth UI state and maps Firebase auth events through {@link evaluateUidAccess}.
 */
export class AuthSessionController {
  private state: AuthViewState = {
    user: null,
    loading: true,
    error: null,
  };
  private listeners = new Set<() => void>();
  private unsubAuth: (() => void) | null = null;

  constructor(
    private readonly port: AuthClientPort,
    private readonly allowedUid: string | undefined
  ) {}

  /**
   * Subscribe to Firebase auth. Call from a React effect so `useSyncExternalStore` has
   * already registered its listener before the first auth callback can run.
   */
  attachAuthListener(): () => void {
    this.unsubAuth?.();
    this.unsubAuth = this.port.onAuthStateChanged((firebaseUser) => {
      const result = evaluateUidAccess(firebaseUser, this.allowedUid);
      if (result.outcome === "signed_out") {
        this.patch({ user: null, loading: false });
        return;
      }
      if (result.outcome === "denied") {
        this.patch({
          error: result.errorMessage,
          user: null,
          loading: false,
        });
        void this.port.signOut();
        return;
      }
      this.patch({ user: result.user, error: null, loading: false });
    });
    return () => {
      this.unsubAuth?.();
      this.unsubAuth = null;
    };
  }

  private patch(p: Partial<AuthViewState>) {
    this.state = { ...this.state, ...p };
    for (const l of this.listeners) l();
  }

  getSnapshot(): AuthViewState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async signIn(): Promise<void> {
    this.patch({ error: null });
    try {
      await this.port.signInWithGoogle();
    } catch (err) {
      this.patch({
        error: err instanceof Error ? err.message : "Sign-in failed",
      });
    }
  }

  async signOut(): Promise<void> {
    this.patch({ error: null });
    await this.port.signOut();
  }

  clearError(): void {
    this.patch({ error: null });
  }

  dispose(): void {
    this.unsubAuth?.();
    this.unsubAuth = null;
    this.listeners.clear();
  }
}

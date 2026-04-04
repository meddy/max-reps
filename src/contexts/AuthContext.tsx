import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { createFirebaseAuthClientPort } from "../lib/auth/firebaseAuthAdapter";
import { AuthSessionController } from "../lib/auth/authSessionController";

const ALLOWED_UID = import.meta.env.VITE_ALLOWED_UID as string | undefined;

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(
    () =>
      new AuthSessionController(createFirebaseAuthClientPort(auth), ALLOWED_UID)
  );

  useEffect(() => {
    return controller.attachAuthListener();
  }, [controller]);

  const state = useSyncExternalStore(
    (onStoreChange) => controller.subscribe(onStoreChange),
    () => controller.getSnapshot(),
    () => ({ user: null, loading: true, error: null })
  );

  const signIn = useCallback(() => controller.signIn(), [controller]);
  const signOut = useCallback(() => controller.signOut(), [controller]);
  const clearError = useCallback(() => controller.clearError(), [controller]);

  const value: AuthContextValue = {
    user: state.user,
    loading: state.loading,
    error: state.error,
    signIn,
    signOut,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Supplies a static auth context for tests. Do not use in production UI. */
export function AuthTestProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AuthContextValue;
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx == null) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

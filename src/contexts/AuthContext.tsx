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
import { getAllowedUid } from "../lib/appConfig";

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  allowedUid: string | undefined;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const allowedUid = getAllowedUid();
  const [controller] = useState(
    () =>
      new AuthSessionController(createFirebaseAuthClientPort(auth), allowedUid)
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
    allowedUid,
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

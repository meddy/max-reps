import type { User } from "firebase/auth";

export type UidAccessResult =
  | { outcome: "signed_out" }
  | { outcome: "denied"; errorMessage: string }
  | { outcome: "allowed"; user: User };

/**
 * Pure whitelist check for single-user deployments. Side effects (sign-out) stay in the caller.
 */
export function evaluateUidAccess(
  firebaseUser: User | null,
  allowedUid: string | undefined
): UidAccessResult {
  if (!firebaseUser) {
    return { outcome: "signed_out" };
  }
  if (allowedUid && firebaseUser.uid !== allowedUid) {
    return { outcome: "denied", errorMessage: "Access denied" };
  }
  return { outcome: "allowed", user: firebaseUser };
}

/** Session hint: user was signed in this browser tab (survives iOS bfcache remounts). */
export const AUTH_SESSION_CACHE_KEY = "max-reps-auth-session";

export function readAuthSessionCached(): boolean {
  try {
    return sessionStorage.getItem(AUTH_SESSION_CACHE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAuthSessionCached(): void {
  try {
    sessionStorage.setItem(AUTH_SESSION_CACHE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearAuthSessionCached(): void {
  try {
    sessionStorage.removeItem(AUTH_SESSION_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

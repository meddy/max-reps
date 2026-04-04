/** Single-user allowlist UID from Vite env (must match Firestore rules). */
export function getAllowedUid(): string | undefined {
  return import.meta.env.VITE_ALLOWED_UID as string | undefined;
}

export function isAllowlistConfigured(): boolean {
  const u = getAllowedUid();
  return u != null && u.length > 0;
}

/** UUID v4 — works in non-secure contexts (e.g. LAN HTTP dev on iOS Safari). */
export function randomId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const n = Math.floor(Math.random() * 16);
    const value = char === "x" ? n : (n & 0x3) | 0x8;
    return value.toString(16);
  });
}

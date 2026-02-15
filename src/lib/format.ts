import type { Timestamp } from "firebase/firestore";

export function formatDate(
  ts: Timestamp,
  options?: { weekday?: boolean }
): string {
  return ts.toDate().toLocaleDateString(undefined, {
    ...(options?.weekday && { weekday: "short" }),
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(ts: Timestamp): string {
  return ts.toDate().toISOString().slice(0, 16);
}

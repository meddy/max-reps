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

export function formatDateShort(ts: Timestamp): string {
  const d = ts.toDate();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

export function formatDateTime(ts: Timestamp): string {
  return ts.toDate().toISOString().slice(0, 16);
}

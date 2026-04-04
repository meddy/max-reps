function asDate(d: Date): Date {
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : new Date(0);
}

export function formatDate(d: Date, options?: { weekday?: boolean }): string {
  const x = asDate(d);
  return x.toLocaleDateString(undefined, {
    ...(options?.weekday && { weekday: "short" }),
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateShort(d: Date): string {
  const x = asDate(d);
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  const yy = String(x.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

/** Value for `<input type="datetime-local" />` (UTC ISO slice matches prior Timestamp behavior). */
export function toDatetimeLocalValue(d: Date): string {
  return asDate(d).toISOString().slice(0, 16);
}

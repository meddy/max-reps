import { Timestamp } from "firebase/firestore";

export function writePayload(
  data: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Date) {
      out[k] = Timestamp.fromDate(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function readTimestampAsDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (
    value != null &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as Timestamp).toDate();
  }
  return new Date(0);
}

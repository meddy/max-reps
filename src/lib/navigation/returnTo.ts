export type ReturnTo = { to: string; label: string };

export const DEFAULT_EXERCISE_RETURN_TO: ReturnTo = {
  to: "/exercises",
  label: "Back to Exercises",
};

export const DEFAULT_DAY_RETURN_TO: ReturnTo = {
  to: "/days",
  label: "Back to Days",
};

export function readReturnTo(
  state: unknown,
  defaultReturnTo: ReturnTo = DEFAULT_EXERCISE_RETURN_TO
): ReturnTo {
  if (state == null || typeof state !== "object") {
    return defaultReturnTo;
  }
  const returnTo = (state as { returnTo?: unknown }).returnTo;
  if (returnTo == null || typeof returnTo !== "object") {
    return defaultReturnTo;
  }
  const { to, label } = returnTo as { to?: unknown; label?: unknown };
  if (typeof to !== "string" || to.length === 0) {
    return defaultReturnTo;
  }
  if (typeof label !== "string" || label.length === 0) {
    return defaultReturnTo;
  }
  return { to, label };
}

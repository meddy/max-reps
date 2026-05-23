export type SetSummaryRow = Readonly<{
  reps: number;
  weight: number;
}>;

function formatWeight(weight: number): string {
  return String(weight);
}

export function formatSetSummary(
  rows: ReadonlyArray<SetSummaryRow>
): string | null {
  const qualifying = rows.filter((row) => row.reps > 0);
  if (qualifying.length === 0) return null;

  const segments: Array<{ weight: number; totalReps: number }> = [];
  for (const row of qualifying) {
    const last = segments[segments.length - 1];
    if (last != null && last.weight === row.weight) {
      last.totalReps += row.reps;
    } else {
      segments.push({ weight: row.weight, totalReps: row.reps });
    }
  }

  return segments
    .map((segment) => `${formatWeight(segment.weight)}x${segment.totalReps}`)
    .join(", ");
}

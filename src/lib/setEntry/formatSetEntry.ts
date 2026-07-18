import {
  parseSetEntry,
  type ParsedSet,
  type SetEntryToken,
} from "./parseSetEntry";

function formatWeight(weight: number): string {
  if (Number.isInteger(weight)) return String(weight);
  return String(weight);
}

function noteNeedsQuotes(note: string): boolean {
  return /[",\\]/.test(note) || note.includes(",");
}

function formatNote(note: string): string {
  if (note.length === 0) return "";
  if (!noteNeedsQuotes(note)) return ` ${note}`;
  const escaped = note.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return ` "${escaped}"`;
}

/**
 * Reconstruct canonical compact Set-entry text from saved Sets.
 * Groups consecutive equal weights; emits `0x` when returning to bodyweight.
 */
export function formatSetEntry(sets: ReadonlyArray<ParsedSet>): string {
  if (sets.length === 0) return "";

  const parts: string[] = [];
  let previousWeight: number | null = null;

  for (const set of sets) {
    const noteSuffix = formatNote(set.note);
    const sameWeight = previousWeight !== null && previousWeight === set.weight;

    if (sameWeight) {
      parts.push(`${set.reps}${noteSuffix}`);
    } else if (set.weight === 0) {
      if (previousWeight !== null && previousWeight !== 0) {
        parts.push(`0x${set.reps}${noteSuffix}`);
      } else {
        parts.push(`${set.reps}${noteSuffix}`);
      }
    } else {
      parts.push(`${formatWeight(set.weight)}x${set.reps}${noteSuffix}`);
    }
    previousWeight = set.weight;
  }

  return parts.join(", ");
}

/** Build styled tokens from already-parsed Sets (for read-only / preview). */
export function tokensFromSets(
  sets: ReadonlyArray<ParsedSet>
): SetEntryToken[] {
  const text = formatSetEntry(sets);
  if (text.length === 0) return [];
  const parsed = parseSetEntry(text);
  return parsed.tokens;
}

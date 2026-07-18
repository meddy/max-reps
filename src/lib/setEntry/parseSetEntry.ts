/** Parsed Set values produced by the compact Set-entry grammar. */
export type ParsedSet = {
  reps: number;
  weight: number;
  note: string;
};

export type SetEntryTokenKind = "weight" | "reps" | "note" | "separator";

export type SetEntryToken = {
  kind: SetEntryTokenKind;
  text: string;
  start: number;
  end: number;
};

export type SetEntryError = {
  message: string;
  start: number;
  end: number;
};

export type SetEntryParseSuccess = {
  ok: true;
  sets: ParsedSet[];
  tokens: SetEntryToken[];
};

export type SetEntryParseFailure = {
  ok: false;
  error: SetEntryError;
  tokens: SetEntryToken[];
};

export type SetEntryParseResult = SetEntryParseSuccess | SetEntryParseFailure;

const WEIGHT_RE = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const REPS_RE = /^[1-9]\d*$/;

type TokenSpan = { text: string; start: number; end: number };

function pushToken(
  tokens: SetEntryToken[],
  kind: SetEntryTokenKind,
  text: string,
  start: number,
  end: number
): void {
  if (end <= start && kind !== "separator") return;
  tokens.push({ kind, text, start, end });
}

function fail(
  tokens: SetEntryToken[],
  message: string,
  start: number,
  end: number
): SetEntryParseFailure {
  return { ok: false, error: { message, start, end }, tokens };
}

function splitTopLevelCommas(input: string): TokenSpan[] {
  const spans: TokenSpan[] = [];
  let i = 0;
  let tokenStart = 0;
  let inQuotes = false;
  let escaped = false;

  while (i < input.length) {
    const ch = input[i];
    if (escaped) {
      escaped = false;
      i += 1;
      continue;
    }
    if (inQuotes) {
      if (ch === "\\") {
        escaped = true;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      spans.push({
        text: input.slice(tokenStart, i),
        start: tokenStart,
        end: i,
      });
      tokenStart = i + 1;
      i += 1;
      continue;
    }
    i += 1;
  }

  spans.push({
    text: input.slice(tokenStart),
    start: tokenStart,
    end: input.length,
  });
  return spans;
}

function trimSpan(span: TokenSpan): TokenSpan {
  let { start, end, text } = span;
  while (start < end && /\s/.test(text[0] ?? "")) {
    start += 1;
    text = text.slice(1);
  }
  while (end > start && /\s/.test(text[text.length - 1] ?? "")) {
    end -= 1;
    text = text.slice(0, -1);
  }
  return { text, start, end };
}

function parseQuotedNote(
  raw: string,
  absoluteStart: number
):
  | {
      ok: true;
      note: string;
      consumed: number;
      quoteStart: number;
      quoteEnd: number;
    }
  | { ok: false; message: string; start: number; end: number } {
  if (!raw.startsWith('"')) {
    return {
      ok: false,
      message: "Expected a quoted note",
      start: absoluteStart,
      end: absoluteStart + raw.length,
    };
  }
  let i = 1;
  let note = "";
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\") {
      const next = raw[i + 1];
      if (next === '"' || next === "\\") {
        note += next;
        i += 2;
        continue;
      }
      return {
        ok: false,
        message: "Invalid escape in note",
        start: absoluteStart + i,
        end: absoluteStart + i + 1,
      };
    }
    if (ch === '"') {
      const consumed = i + 1;
      const trailing = raw.slice(consumed).trim();
      if (trailing.length > 0) {
        return {
          ok: false,
          message: "Unexpected text after quoted note",
          start: absoluteStart + consumed,
          end: absoluteStart + raw.length,
        };
      }
      return {
        ok: true,
        note,
        consumed,
        quoteStart: absoluteStart,
        quoteEnd: absoluteStart + consumed,
      };
    }
    note += ch;
    i += 1;
  }
  return {
    ok: false,
    message: "Unclosed quoted note",
    start: absoluteStart,
    end: absoluteStart + raw.length,
  };
}

function parseNoteTail(
  raw: string,
  absoluteStart: number
):
  | { ok: true; note: string; noteStart: number; noteEnd: number }
  | { ok: false; message: string; start: number; end: number } {
  const trimmedStart = raw.match(/^\s*/)?.[0].length ?? 0;
  const body = raw.slice(trimmedStart);
  if (body.length === 0) {
    return {
      ok: true,
      note: "",
      noteStart: absoluteStart,
      noteEnd: absoluteStart,
    };
  }
  if (body.startsWith('"')) {
    const quoted = parseQuotedNote(body, absoluteStart + trimmedStart);
    if (!quoted.ok) return quoted;
    return {
      ok: true,
      note: quoted.note,
      noteStart: quoted.quoteStart,
      noteEnd: quoted.quoteEnd,
    };
  }
  return {
    ok: true,
    note: body,
    noteStart: absoluteStart + trimmedStart,
    noteEnd: absoluteStart + trimmedStart + body.length,
  };
}

function parseWeightRepsPrefix(
  text: string
):
  | { kind: "weight"; weight: number; reps: number; prefixLength: number }
  | { kind: "reps"; reps: number; prefixLength: number }
  | { kind: "error"; message: string; localStart: number; localEnd: number } {
  const xIndex = text.search(/x/i);
  if (xIndex >= 0) {
    const weightText = text.slice(0, xIndex).trim();
    const afterX = text.slice(xIndex + 1);
    const repsMatch = afterX.match(/^\s*([1-9]\d*)/);
    if (!WEIGHT_RE.test(weightText)) {
      return {
        kind: "error",
        message: "Weight must be a nonnegative number",
        localStart: 0,
        localEnd: Math.max(xIndex, 1),
      };
    }
    if (!repsMatch) {
      return {
        kind: "error",
        message: "Reps must be a positive whole number",
        localStart: xIndex + 1,
        localEnd: text.length,
      };
    }
    const weight = Number(weightText);
    if (!Number.isFinite(weight) || weight < 0) {
      return {
        kind: "error",
        message: "Weight must be a nonnegative number",
        localStart: 0,
        localEnd: xIndex,
      };
    }
    const reps = Number(repsMatch[1]);
    const prefixLength = xIndex + 1 + (repsMatch[0]?.length ?? 0);
    return { kind: "weight", weight, reps, prefixLength };
  }

  const repsMatch = text.match(/^([1-9]\d*)/);
  if (!repsMatch) {
    return {
      kind: "error",
      message: "Expected reps or weight×reps",
      localStart: 0,
      localEnd: text.length || 1,
    };
  }
  if (!REPS_RE.test(repsMatch[1])) {
    return {
      kind: "error",
      message: "Reps must be a positive whole number",
      localStart: 0,
      localEnd: repsMatch[0].length,
    };
  }
  return {
    kind: "reps",
    reps: Number(repsMatch[1]),
    prefixLength: repsMatch[0].length,
  };
}

/**
 * Parse compact Set-entry text into Sets and styled tokens.
 * Empty / whitespace-only input is valid and yields zero Sets.
 */
export function parseSetEntry(input: string): SetEntryParseResult {
  const tokens: SetEntryToken[] = [];
  const trimmedAll = input.trim();
  if (trimmedAll.length === 0) {
    return { ok: true, sets: [], tokens };
  }

  const spans = splitTopLevelCommas(input);
  const sets: ParsedSet[] = [];
  let currentWeight = 0;

  for (let spanIndex = 0; spanIndex < spans.length; spanIndex++) {
    const rawSpan = spans[spanIndex];
    if (spanIndex > 0) {
      pushToken(tokens, "separator", ",", rawSpan.start - 1, rawSpan.start);
    }

    const span = trimSpan(rawSpan);
    if (span.text.length === 0) {
      return fail(
        tokens,
        "Empty set entry",
        rawSpan.start,
        Math.max(rawSpan.end, rawSpan.start + 1)
      );
    }

    const prefix = parseWeightRepsPrefix(span.text);
    if (prefix.kind === "error") {
      return fail(
        tokens,
        prefix.message,
        span.start + prefix.localStart,
        span.start + prefix.localEnd
      );
    }

    let reps: number;
    let weight: number;
    if (prefix.kind === "weight") {
      weight = prefix.weight;
      reps = prefix.reps;
      currentWeight = weight;
      const weightEnd = span.start + span.text.toLowerCase().indexOf("x");
      pushToken(
        tokens,
        "weight",
        span.text.slice(0, span.text.toLowerCase().indexOf("x")).trim(),
        span.start,
        weightEnd
      );
      const repsText = String(reps);
      const repsLocalStart = prefix.prefixLength - repsText.length;
      pushToken(
        tokens,
        "reps",
        repsText,
        span.start + repsLocalStart,
        span.start + prefix.prefixLength
      );
    } else {
      reps = prefix.reps;
      weight = currentWeight;
      pushToken(
        tokens,
        "reps",
        String(reps),
        span.start,
        span.start + prefix.prefixLength
      );
    }

    const noteRaw = span.text.slice(prefix.prefixLength);
    const noteResult = parseNoteTail(noteRaw, span.start + prefix.prefixLength);
    if (!noteResult.ok) {
      return fail(tokens, noteResult.message, noteResult.start, noteResult.end);
    }
    if (noteResult.note.length > 0) {
      pushToken(
        tokens,
        "note",
        noteResult.note,
        noteResult.noteStart,
        noteResult.noteEnd
      );
    }

    sets.push({ reps, weight, note: noteResult.note });
  }

  return { ok: true, sets, tokens };
}

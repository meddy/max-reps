import type { SetEntryToken } from "../../lib/setEntry";

const TOKEN_CLASS: Record<SetEntryToken["kind"], string> = {
  weight: "font-semibold text-amber-700",
  reps: "font-medium text-slate-900",
  note: "italic text-emerald-700",
  separator: "text-slate-400",
};

/**
 * Non-editable styled Set-entry tokens for read-only cards and live preview.
 * Hidden from assistive technology when `ariaHidden` (duplicate of editable text).
 */
export function SetEntryTokens({
  tokens,
  ariaHidden = false,
  className = "",
}: {
  tokens: ReadonlyArray<SetEntryToken>;
  ariaHidden?: boolean;
  className?: string;
}) {
  if (tokens.length === 0) {
    return (
      <span
        className={`text-sm text-slate-400 ${className}`}
        aria-hidden={ariaHidden || undefined}
      >
        —
      </span>
    );
  }

  return (
    <span
      className={`inline text-sm leading-relaxed ${className}`}
      aria-hidden={ariaHidden || undefined}
    >
      {tokens.map((token, index) => (
        <span
          key={`${token.start}-${index}`}
          className={TOKEN_CLASS[token.kind]}
        >
          {token.kind === "separator"
            ? ", "
            : token.kind === "note"
              ? ` ${token.text}`
              : token.text}
          {token.kind === "weight" ? "×" : null}
        </span>
      ))}
    </span>
  );
}

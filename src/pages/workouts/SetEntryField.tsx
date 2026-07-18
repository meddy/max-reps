import { useId } from "react";

export function SetEntryField({
  value,
  onChange,
  onBlur,
  error,
  helpId,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error: { message: string; start: number; end: number } | null;
  helpId?: string;
  disabled?: boolean;
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const describedBy = [helpId, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-1.5" data-no-dnd>
      <label htmlFor={fieldId} className="sr-only">
        Sets
      </label>
      <textarea
        id={fieldId}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={2}
        spellCheck={false}
        aria-invalid={error != null}
        aria-describedby={describedBy || undefined}
        placeholder="e.g. 45x6,7,8 or 9 new technique"
        className={`w-full resize-y rounded-lg border px-3 py-2 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          error ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
        }`}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {error.message}
          {error.end > error.start
            ? ` (at characters ${error.start + 1}–${error.end})`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

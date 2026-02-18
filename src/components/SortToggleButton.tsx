type SortOrder = "asc" | "desc";

export function SortToggleButton({
  value,
  onChange,
  ariaLabel = "Sort",
  ascLabel,
  descLabel,
}: {
  value: SortOrder;
  onChange: (order: SortOrder) => void;
  ariaLabel?: string;
  /** Custom label when value is "asc" (e.g. "Oldest first"). Default: "A → Z" */
  ascLabel?: string;
  /** Custom label when value is "desc" (e.g. "Newest first"). Default: "Z → A" */
  descLabel?: string;
}) {
  const label =
    value === "asc" ? (ascLabel ?? "A → Z") : (descLabel ?? "Z → A");
  const ariaLabelFull =
    value === "asc"
      ? `${ariaLabel} (currently ${label})`
      : `${ariaLabel} (currently ${label})`;

  return (
    <button
      type="button"
      onClick={() => onChange(value === "asc" ? "desc" : "asc")}
      aria-label={ariaLabelFull}
      title={ariaLabelFull}
      className={`min-h-[44px] rounded-xl px-3 text-sm font-medium transition-colors ${
        value === "asc"
          ? "bg-indigo-600 text-white hover:bg-indigo-500"
          : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );
}

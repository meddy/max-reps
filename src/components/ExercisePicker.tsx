import type { ReactNode } from "react";
import { useEffect } from "react";
import { useExercisePicker } from "../hooks/useExercisePicker";

export type ExerciseChoice = { id: string; displayName: string };

export interface ExercisePickerProps {
  active: boolean;
  onCommit: (exercise: ExerciseChoice) => void;
  /** Called when user taps Cancel in staged flow (e.g. close parent modal). */
  onStagedCancel?: () => void;
  flow?: "direct" | "staged";
  renderStagedAccessory?: (exercise: ExerciseChoice) => ReactNode;
  stagedConfirmLabel?: string;
  searchPlaceholder?: string;
}

export function ExercisePicker({
  active,
  onCommit,
  onStagedCancel,
  flow = "staged",
  renderStagedAccessory,
  stagedConfirmLabel = "Add",
  searchPlaceholder = "Search exercises",
}: ExercisePickerProps) {
  const picker = useExercisePicker({ active });
  const { selected: directSelected, reset: resetPicker } = picker;

  useEffect(() => {
    if (flow !== "direct" || !active || !directSelected) return;
    onCommit(directSelected);
    resetPicker();
  }, [flow, active, directSelected, onCommit, resetPicker]);

  const commitStaged = () => {
    if (!picker.selected) return;
    onCommit(picker.selected);
    picker.reset();
  };

  if (flow === "direct") {
    return (
      <>
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={picker.search}
          onChange={(e) => {
            picker.setSearch(e.target.value);
          }}
          className="mt-3 min-h-[44px] w-full rounded-xl border border-gray-300 px-4 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <ul className="mt-2 max-h-40 overflow-auto">
          {picker.results.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => {
                  onCommit({ id: ex.id, displayName: ex.displayName });
                  picker.reset();
                }}
                className="min-h-[44px] w-full rounded-lg px-3 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                {ex.displayName}
              </button>
            </li>
          ))}
        </ul>
        {picker.showCreatePrompt && (
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void picker.createExerciseFromSearch()}
              className="min-h-[44px] w-full rounded-xl border border-dashed border-gray-400 bg-gray-50 font-medium text-gray-700 hover:border-indigo-500 hover:bg-indigo-100 hover:text-indigo-700"
            >
              Create exercise &ldquo;{picker.search.trim()}&rdquo;
            </button>
            {picker.createExerciseError && (
              <p className="text-sm text-red-600">
                {picker.createExerciseError}
              </p>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {picker.selected ? (
        <div className="mt-3 flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 px-4">
          <span className="flex-1 truncate text-sm font-medium text-gray-900">
            {picker.selected.displayName}
          </span>
          <button
            type="button"
            onClick={() => picker.clearSelection()}
            className="flex size-8 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-800"
            aria-label="Clear selection"
          >
            <span className="text-sm">✕</span>
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={picker.search}
            onChange={(e) => picker.setSearch(e.target.value)}
            className="mt-3 min-h-[44px] w-full rounded-xl border border-gray-300 px-4 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <ul className="mt-2 max-h-40 overflow-auto">
            {picker.results.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  onClick={() => picker.selectExercise(ex)}
                  className="min-h-[44px] w-full rounded-lg px-3 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  {ex.displayName}
                </button>
              </li>
            ))}
          </ul>
          {picker.showCreatePrompt && (
            <div className="mt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void picker.createExerciseFromSearch()}
                className="min-h-[44px] w-full rounded-xl border border-dashed border-gray-400 bg-gray-50 font-medium text-gray-700 hover:border-indigo-500 hover:bg-indigo-100 hover:text-indigo-700"
              >
                Create exercise &ldquo;{picker.search.trim()}&rdquo;
              </button>
              {picker.createExerciseError && (
                <p className="text-sm text-red-600">
                  {picker.createExerciseError}
                </p>
              )}
            </div>
          )}
        </>
      )}
      {picker.selected && (
        <>
          {renderStagedAccessory?.(picker.selected)}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                picker.reset();
                onStagedCancel?.();
              }}
              className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commitStaged}
              className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-700"
            >
              {stagedConfirmLabel}
            </button>
          </div>
        </>
      )}
    </>
  );
}

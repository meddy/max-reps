export interface ExerciseCardProps {
  exerciseName: string;
  metadata?: React.ReactNode;
  onRemove: () => void;
  onAddSet: () => void;
  children: React.ReactNode;
}

export function ExerciseCard({
  exerciseName,
  metadata,
  onRemove,
  onAddSet,
  children,
}: ExerciseCardProps) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium text-gray-900">{exerciseName}</p>
        <button
          type="button"
          onClick={onRemove}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50"
          aria-label="Remove exercise"
        >
          <svg
            className="size-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
      {metadata}
      <ul className="mt-3 flex flex-col gap-6 sm:gap-2">{children}</ul>
      <button
        type="button"
        onClick={onAddSet}
        className="mt-2 min-h-[44px] text-sm text-indigo-600 hover:underline"
      >
        + Add set
      </button>
    </div>
  );
}

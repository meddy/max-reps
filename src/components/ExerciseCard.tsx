import { Link } from "react-router-dom";
import { IconTrash } from "./Icons";

export interface ExerciseCardProps {
  exerciseName: string;
  exerciseId?: string;
  metadata?: React.ReactNode;
  /** Segments only, e.g. "150x5, 130x18". Hidden when null/undefined. */
  setSummary?: string | null;
  onRemove: () => void;
  onAddSet: () => void;
  children: React.ReactNode;
}

export function ExerciseCard({
  exerciseName,
  exerciseId,
  metadata,
  setSummary,
  onRemove,
  onAddSet,
  children,
}: ExerciseCardProps) {
  const nameElement = exerciseId ? (
    <Link
      to={`/exercises/${exerciseId}`}
      className="font-medium text-gray-900 hover:text-indigo-700 hover:underline"
    >
      {exerciseName}
    </Link>
  ) : (
    <p className="font-medium text-gray-900">{exerciseName}</p>
  );
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        {nameElement}
        <button
          type="button"
          onClick={onRemove}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-600 hover:bg-red-100"
          aria-label={`Remove ${exerciseName}`}
          title={`Remove ${exerciseName}`}
        >
          <IconTrash className="size-6" />
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
      {setSummary != null && (
        <p className="mt-2 text-sm text-gray-500">
          <strong>Summary:</strong> {setSummary}
        </p>
      )}
    </div>
  );
}

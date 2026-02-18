import { IconTrash } from "./Icons";

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
          <IconTrash className="size-5" />
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

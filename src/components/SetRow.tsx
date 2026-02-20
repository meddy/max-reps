import { IconTrash } from "./Icons";

export interface SetRowProps {
  reps: number;
  weight: number;
  note: string;
  onRepsChange: (val: number) => void;
  onWeightChange: (val: number) => void;
  onNoteChange: (val: string) => void;
  onBlur?: () => void;
  onDelete: () => void;
  deleteAriaLabel?: string;
}

export function SetRow({
  reps,
  weight,
  note,
  onRepsChange,
  onWeightChange,
  onNoteChange,
  onBlur,
  onDelete,
  deleteAriaLabel = "Delete set",
}: SetRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto sm:flex-initial">
        <input
          type="number"
          min={0}
          step={0.5}
          placeholder="Weight"
          value={weight || ""}
          onChange={(e) => onWeightChange(Number(e.target.value) || 0)}
          onBlur={onBlur}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm sm:w-24 sm:min-w-[6rem] sm:flex-none"
        />
        <span className="text-sm text-gray-500"> × </span>
        <input
          type="number"
          min={0}
          placeholder="Reps"
          value={reps || ""}
          onChange={(e) => onRepsChange(Number(e.target.value) || 0)}
          onBlur={onBlur}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm sm:w-20 sm:min-w-[5rem] sm:flex-none"
        />
      </div>
      <input
        type="text"
        placeholder="Note"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        onBlur={onBlur}
        className="min-w-0 basis-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm sm:basis-auto sm:flex-1 sm:min-w-[80px]"
      />
      <div className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-auto sm:flex-initial">
        <button
          type="button"
          onClick={onDelete}
          className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
          aria-label={deleteAriaLabel}
          title={deleteAriaLabel}
        >
          <IconTrash className="size-5" />
        </button>
      </div>
    </li>
  );
}

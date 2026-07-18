import { useEffect, useId, useRef, useState } from "react";
import { IconTrash } from "../../components/Icons";

export type WorkoutOptionsMenuProps = {
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  disabled?: boolean;
};

export function WorkoutOptionsMenu({
  onEdit,
  onDelete,
  onCopy,
  disabled = false,
}: WorkoutOptionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
        aria-label="Workout options"
      >
        <span aria-hidden className="text-xl leading-none">
          ⋮
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onCopy();
            }}
          >
            Copy
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <IconTrash className="h-4 w-4" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

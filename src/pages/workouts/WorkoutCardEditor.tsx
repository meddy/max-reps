import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, useMemo, useState } from "react";
import { AddExerciseModal } from "../../components/AddExerciseModal";
import { IconPlus, IconTrash } from "../../components/Icons";
import { SortableDragPlaceholder } from "../../lib/dnd/SortableDragPlaceholder";
import { DragOverlayChip } from "../../lib/dnd/DragOverlayChip";
import {
  GuardedPointerSensor,
  GuardedTouchSensor,
} from "../../lib/dnd/guardedSensors";
import type { Day } from "../../types";
import type { InlineExerciseDraft } from "../../lib/workoutEditor/createInlineWorkoutEditor";
import { parseSetEntry } from "../../lib/setEntry";
import { SetEntryField } from "./SetEntryField";
import { SetEntryTokens } from "./SetEntryTokens";
import { toDateInputValue, workoutDisplayName } from "./workoutCardModel";

export type DayOption = Day & { id: string };

const SET_ENTRY_HELP = (
  <>
    Comma-separated sets. Use <span className="font-mono">WxR</span> for weight,
    bare reps to inherit, <span className="font-mono">0xR</span> for bodyweight,
    quotes for notes with commas.
  </>
);

function SortableExerciseEditor({
  draft,
  disabled,
  helpId,
  onTextChange,
  onBlur,
  onRemove,
}: {
  draft: InlineExerciseDraft;
  disabled: boolean;
  helpId: string;
  onTextChange: (text: string) => void;
  onBlur: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: draft.localId, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style}>
        <SortableDragPlaceholder />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      {...attributes}
      {...listeners}
    >
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">
            {draft.exerciseName}
          </div>
          {draft.setTargetLabel ? (
            <div className="text-xs text-slate-500">
              Day target: {draft.setTargetLabel}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          data-no-dnd
          onClick={onRemove}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
          aria-label={`Remove ${draft.exerciseName}`}
        >
          <IconTrash className="h-5 w-5" />
        </button>
      </div>
      <SetEntryField
        value={draft.text}
        error={draft.parseError}
        helpId={helpId}
        onChange={onTextChange}
        onBlur={onBlur}
        disabled={false}
      />
    </div>
  );
}

export function WorkoutCardEditor({
  workoutId,
  date,
  dayId,
  dayNameSnapshot,
  note,
  drafts,
  days,
  queueStatus,
  queueError,
  hasInvalidDraft,
  fillWarning,
  onDateChange,
  onNoteChange,
  onTitleChange,
  onDayChange,
  onTextChange,
  onFlushDraft,
  onRemoveExercise,
  onReorder,
  onAddExercise,
  onFillFromDay,
  onDeleteWorkout,
  onConfirm,
  onRetry,
}: {
  workoutId: string;
  date: Date;
  dayId: string;
  dayNameSnapshot: string;
  note: string;
  drafts: InlineExerciseDraft[];
  days: DayOption[];
  queueStatus: "idle" | "pending" | "failed";
  queueError: Error | null;
  hasInvalidDraft: boolean;
  fillWarning?: string | null;
  onDateChange: (date: Date) => void;
  onNoteChange: (note: string) => void;
  onTitleChange: (title: string) => void;
  onDayChange: (dayId: string) => void;
  onTextChange: (localId: string, text: string) => void;
  onFlushDraft: (localId: string) => void;
  onRemoveExercise: (localId: string) => void;
  onReorder: (activeLocalId: string, overLocalId: string) => void;
  onAddExercise: (exerciseId: string, name: string) => void;
  onFillFromDay: () => void;
  onDeleteWorkout: () => void;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const helpId = useId();
  const name = workoutDisplayName(dayNameSnapshot);
  const dndDisabled =
    hasInvalidDraft || queueStatus === "pending" || queueStatus === "failed";

  const sensors = useSensors(
    useSensor(GuardedPointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(GuardedTouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    })
  );

  const activeDraft = useMemo(
    () => drafts.find((d) => d.localId === activeId) ?? null,
    [activeId, drafts]
  );

  const previewLines = useMemo(() => {
    return drafts
      .filter((d) => d.text.trim().length > 0)
      .map((d) => {
        const parsed = parseSetEntry(d.text);
        return {
          localId: d.localId,
          exerciseName: d.exerciseName,
          tokens: parsed.tokens,
          ok: parsed.ok,
        };
      });
  }, [drafts]);

  const isUnlogged = !drafts.some((d) => d.setIds.length > 0);

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  }

  return (
    <article
      className="rounded-xl border-2 border-indigo-400 bg-indigo-50/30 p-4 shadow-sm"
      data-workout-id={workoutId}
      data-editing="true"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="space-y-1" data-no-dnd>
          <label
            className="block text-xs font-medium text-slate-500"
            htmlFor={`date-${workoutId}`}
          >
            Date
          </label>
          <input
            id={`date-${workoutId}`}
            type="date"
            value={toDateInputValue(date)}
            onChange={(e) => {
              if (!e.target.value) return;
              const [y, m, d] = e.target.value.split("-").map(Number);
              onDateChange(new Date(y, m - 1, d, 12, 0, 0, 0));
            }}
            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="min-w-[10rem] flex-1 space-y-1" data-no-dnd>
          <label
            className="block text-xs font-medium text-slate-500"
            htmlFor={`day-${workoutId}`}
          >
            Day
          </label>
          <select
            id={`day-${workoutId}`}
            value={dayId}
            onChange={(e) => onDayChange(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">No Day</option>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.displayName}
              </option>
            ))}
          </select>
        </div>
        {dayId ? (
          <div className="pt-5">
            <div
              className={
                name.isPlaceholder
                  ? "italic text-slate-400"
                  : "font-semibold text-indigo-800"
              }
            >
              {name.text}
            </div>
          </div>
        ) : (
          <div className="min-w-[10rem] flex-1 space-y-1" data-no-dnd>
            <label
              className="block text-xs font-medium text-slate-500"
              htmlFor={`title-${workoutId}`}
            >
              Title
            </label>
            <input
              id={`title-${workoutId}`}
              type="text"
              value={dayNameSnapshot}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Untitled workout"
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-indigo-800 placeholder:italic placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1" data-no-dnd>
        <label
          className="block text-xs font-medium text-slate-500"
          htmlFor={`note-${workoutId}`}
        >
          Workout note
        </label>
        <input
          id={`note-${workoutId}`}
          type="text"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm italic text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Optional note"
        />
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2"
        data-no-dnd
      >
        {dayId ? (
          <button
            type="button"
            onClick={onFillFromDay}
            className="min-h-[44px] rounded-xl border border-indigo-300 bg-white px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Fill from Day
          </button>
        ) : null}
        <p id={helpId} className="text-xs text-slate-500">
          {SET_ENTRY_HELP}
        </p>
      </div>

      {fillWarning ? (
        <p className="mt-2 text-sm text-amber-700" role="status">
          {fillWarning}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={drafts.map((d) => d.localId)}
            strategy={verticalListSortingStrategy}
          >
            {drafts.map((draft) => (
              <SortableExerciseEditor
                key={draft.localId}
                draft={draft}
                disabled={dndDisabled}
                helpId={helpId}
                onTextChange={(text) => onTextChange(draft.localId, text)}
                onBlur={() => onFlushDraft(draft.localId)}
                onRemove={() => onRemoveExercise(draft.localId)}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {activeDraft ? (
              <DragOverlayChip label={activeDraft.exerciseName} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <div className="mt-4" data-no-dnd>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-400 bg-white px-3 text-sm font-medium text-slate-700 hover:border-indigo-500"
        >
          <IconPlus className="h-4 w-4" />
          Add exercise
        </button>
      </div>

      {previewLines.length > 0 ? (
        <div
          className="mt-4 rounded-lg bg-slate-50 px-3 py-2"
          aria-hidden
          data-no-dnd
        >
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Preview
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {previewLines.map((line) => (
              <li
                key={line.localId}
                className={`text-sm leading-relaxed ${
                  line.ok ? "" : "opacity-70"
                }`}
              >
                <span
                  className={
                    line.ok
                      ? "font-semibold text-slate-800"
                      : "font-semibold text-amber-800"
                  }
                >
                  {line.exerciseName}
                </span>
                <span className="text-slate-300"> — </span>
                <SetEntryTokens tokens={line.tokens} ariaHidden />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3" data-no-dnd>
        <div className="min-h-[20px] flex-1 text-sm" aria-live="polite">
          {queueStatus === "pending" ? (
            <span className="text-slate-500">Saving…</span>
          ) : null}
          {queueStatus === "failed" ? (
            <span className="text-red-600">
              Save failed{queueError ? `: ${queueError.message}` : ""}{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={onRetry}
              >
                Retry
              </button>
            </span>
          ) : null}
          {queueStatus === "idle" && !hasInvalidDraft ? (
            <span className="text-emerald-700">Saved</span>
          ) : null}
          {hasInvalidDraft ? (
            <span className="text-amber-700">
              Fix invalid Sets before confirming
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDeleteWorkout}
          className={
            isUnlogged
              ? "min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              : "min-h-[44px] rounded-xl border border-red-200 bg-white px-3 text-sm font-medium text-red-600 hover:bg-red-50"
          }
        >
          {isUnlogged ? "Cancel" : "Delete workout"}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={hasInvalidDraft || queueStatus === "failed"}
          className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm
        </button>
      </div>

      <AddExerciseModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(exerciseId, exerciseName) => {
          onAddExercise(exerciseId, exerciseName);
          setAddOpen(false);
        }}
      />
    </article>
  );
}

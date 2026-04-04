import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDataAccess } from "../../contexts/DataAccessContext";
import { createWorkoutEditorPersistence } from "../../lib/workoutEditor/persistence";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { IconTrash } from "../../components/Icons";
import { ExerciseCard } from "../../components/ExerciseCard";
import { SetRow } from "../../components/SetRow";
import { AddExerciseModal } from "../../components/AddExerciseModal";
import { formatDate, toDatetimeLocalValue } from "../../lib/format";
import {
  useWorkoutEditor,
  type EditorExerciseGroup,
} from "../../lib/workoutEditor/useWorkoutEditor";
import { syncWorkoutDateAndSetsPerformedAt } from "./workoutDetailFlow";
import { useWorkoutDetailModel } from "./useWorkoutDetailModel";

export function WorkoutDetail() {
  const dataAccess = useDataAccess();
  const { id: workoutId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    workout,
    setWorkout,
    loading,
    isTemplateMode,
    templateModeLoading,
    editorSeed,
  } = useWorkoutDetailModel(workoutId, dataAccess);

  const [editingDate, setEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [deleteSetRowId, setDeleteSetRowId] = useState<string | null>(null);
  const [removeExerciseGroupKey, setRemoveExerciseGroupKey] = useState<
    string | null
  >(null);
  const [deleteWorkoutConfirm, setDeleteWorkoutConfirm] = useState(false);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);

  const [pendingDeleteTemplateSetRowId, setPendingDeleteTemplateSetRowId] =
    useState<string | null>(null);
  const [removeExerciseTemplateGroupKey, setRemoveExerciseTemplateGroupKey] =
    useState<string | null>(null);

  useEffect(() => {
    if (workout) setDateInput(toDatetimeLocalValue(workout.date));
  }, [workout?.id, workout?.date]);

  const persistence = useMemo(
    () => createWorkoutEditorPersistence(dataAccess),
    [dataAccess]
  );

  const editor = useWorkoutEditor({
    variant: editorSeed?.variant ?? "workout",
    workoutId: workoutId ?? "",
    workout,
    initialGroups: editorSeed?.groups ?? [],
    resetKey: editorSeed?.resetKey ?? "__loading",
    persistence,
  });

  const saveDate = async () => {
    if (!workout || !dateInput) return;
    const newDate = new Date(dateInput);
    await syncWorkoutDateAndSetsPerformedAt(dataAccess, {
      workoutId: workout.id,
      date: newDate,
    });

    setWorkout((prev) => (prev ? { ...prev, date: newDate } : null));
    setEditingDate(false);
  };

  const saveNote = async (value: string) => {
    if (!workout) return;
    await dataAccess.workouts.update(workout.id, { note: value });
    setWorkout((prev) => (prev ? { ...prev, note: value } : null));
  };

  const handleConfirmDeleteSet = async () => {
    if (!deleteSetRowId) return;
    await editor.removeSet(deleteSetRowId);
    setDeleteSetRowId(null);
  };

  const handleConfirmRemoveExercise = async () => {
    const groupKey = removeExerciseGroupKey;
    if (!groupKey) return;
    await editor.removeExercise(groupKey);
    setRemoveExerciseGroupKey(null);
  };

  const handleAddExercise = useCallback(
    (exerciseId: string, exerciseName: string) => {
      editor.addExercise(exerciseId, exerciseName);
      setAddExerciseOpen(false);
    },
    [editor]
  );

  const handleAddExerciseTemplate = useCallback(
    async (exerciseId: string, exerciseName: string) => {
      if (!workout || !workoutId) return;
      const syntheticId = `adhoc-${crypto.randomUUID()}`;
      const virtualGroup: EditorExerciseGroup = {
        groupKey: syntheticId,
        exerciseId,
        exerciseName,
        dayId: workout.dayId,
        rows: [
          {
            id: crypto.randomUUID(),
            reps: 0,
            weight: 0,
            note: "",
          },
        ],
        templateMeta: { repsLower: 0, repsUpper: 0, isAdHoc: true },
      };
      editor.appendTemplateGroup(virtualGroup);
      const result = await dataAccess.sets.lastPerformedGroupForExercise(
        exerciseId,
        workoutId
      );
      if (result.sets.length > 0 && result.workoutId) {
        editor.updateLastPerformed(exerciseId, {
          sets: result.sets,
          workoutId: result.workoutId,
        });
      }
      setAddExerciseOpen(false);
    },
    [dataAccess, editor, workout, workoutId]
  );

  const handleDeleteWorkout = async () => {
    if (!workoutId) return;
    await dataAccess.workouts.deleteWithSets(workoutId);
    setDeleteWorkoutConfirm(false);
    navigate("/workouts");
  };

  const removeWorkoutSetRow = (row: {
    id: string;
    persistedSetId?: string;
  }) => {
    if (row.persistedSetId) setDeleteSetRowId(row.id);
    else void editor.removeSet(row.id);
  };

  const removeTemplateSetRow = (row: {
    id: string;
    persistedSetId?: string;
  }) => {
    if (row.persistedSetId) setPendingDeleteTemplateSetRowId(row.id);
    else void editor.removeSet(row.id);
  };

  const handleConfirmDeleteSetTemplate = async () => {
    if (!pendingDeleteTemplateSetRowId) return;
    await editor.removeSet(pendingDeleteTemplateSetRowId);
    setPendingDeleteTemplateSetRowId(null);
  };

  const handleConfirmRemoveExerciseTemplate = async () => {
    const groupKey = removeExerciseTemplateGroupKey;
    if (!groupKey) return;
    await editor.removeExercise(groupKey);
    setRemoveExerciseTemplateGroupKey(null);
  };

  if (loading && !workout) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (workout && templateModeLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!workout) {
    return (
      <div>
        <p className="text-gray-500">Workout not found.</p>
        <button
          type="button"
          onClick={() => navigate("/workouts")}
          className="mt-2 text-indigo-600 hover:underline"
        >
          Back to History
        </button>
      </div>
    );
  }

  const headerCard = (
    <div className="rounded-xl border-l-4 border-indigo-500 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium text-gray-900">{workout.dayNameSnapshot}</p>
        <button
          type="button"
          onClick={() => setDeleteWorkoutConfirm(true)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-600 hover:bg-red-100"
          aria-label="Delete workout"
          title="Delete workout"
        >
          <IconTrash className="size-6" />
        </button>
      </div>
      <input
        type="text"
        placeholder="Add a note (optional)"
        value={workout.note ?? ""}
        onChange={(e) =>
          setWorkout((prev) =>
            prev ? { ...prev, note: e.target.value } : null
          )
        }
        onBlur={(e) => void saveNote(e.target.value)}
        className="mt-2 min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );

  if (isTemplateMode) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate("/workouts")}
            className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700"
          >
            Back to History
          </button>
        </div>

        {headerCard}

        {editor.groups.map((group) => {
          const last = group.lastPerformed;
          const lastFormatted =
            last && last.sets.length > 0
              ? last.sets.map((s) => `${s.weight}x${s.reps}`).join(", ") +
                " lbs"
              : null;
          const lastNotes =
            last?.sets?.map((s) => s.note?.trim()).filter(Boolean) ?? [];
          const notesText = lastNotes.length > 0 ? lastNotes.join(" • ") : null;
          const meta = group.templateMeta;
          const isAdHoc = meta?.isAdHoc;
          const dayId = group.dayId ?? workout.dayId;

          const metadata =
            !isAdHoc && meta ? (
              <div className="space-y-1">
                <p className="text-sm text-gray-500">
                  <strong>Target:</strong>{" "}
                  <Link
                    to={`/days/${dayId}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {meta.repsLower}–{meta.repsUpper} reps
                  </Link>
                  {lastFormatted && last?.workoutId && (
                    <span className="ml-2">
                      <strong>Last:</strong>{" "}
                      <Link
                        to={`/workouts/${last.workoutId}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {lastFormatted}
                      </Link>
                    </span>
                  )}
                </p>
                {notesText && (
                  <p className="text-sm text-gray-500">
                    <strong>Notes:</strong> {notesText}
                  </p>
                )}
              </div>
            ) : (
              lastFormatted &&
              last?.workoutId && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">
                    Last:{" "}
                    <Link
                      to={`/workouts/${last.workoutId}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {lastFormatted}
                    </Link>
                  </p>
                  {notesText && (
                    <p className="text-sm text-gray-500">
                      <strong>Notes:</strong> {notesText}
                    </p>
                  )}
                </div>
              )
            );

          return (
            <ExerciseCard
              key={group.groupKey}
              exerciseName={group.exerciseName}
              exerciseId={group.exerciseId}
              metadata={metadata}
              onRemove={() => setRemoveExerciseTemplateGroupKey(group.groupKey)}
              onAddSet={() => editor.addSet(group.groupKey)}
            >
              {group.rows.map((row) => {
                const api = editor.getRowApi(row.id);
                return (
                  <SetRow
                    key={row.id}
                    reps={row.reps}
                    weight={row.weight}
                    note={row.note}
                    onRepsChange={(val) => api.setField("reps", val)}
                    onWeightChange={(val) => api.setField("weight", val)}
                    onNoteChange={(val) => api.setField("note", val)}
                    onDelete={() => removeTemplateSetRow(row)}
                    deleteAriaLabel={
                      row.persistedSetId ? "Delete set" : "Remove set"
                    }
                  />
                );
              })}
            </ExerciseCard>
          );
        })}

        <button
          type="button"
          onClick={() => setAddExerciseOpen(true)}
          className="min-h-[44px] w-full rounded-xl border border-dashed border-gray-400 bg-white font-medium text-gray-700 hover:border-indigo-500 hover:bg-indigo-100 hover:text-indigo-700"
        >
          + Add exercise
        </button>

        <AddExerciseModal
          open={addExerciseOpen}
          onClose={() => setAddExerciseOpen(false)}
          onAdd={(exerciseId, exerciseName) =>
            void handleAddExerciseTemplate(exerciseId, exerciseName)
          }
        />

        <ConfirmDialog
          open={pendingDeleteTemplateSetRowId != null}
          title="Delete set"
          message="Remove this set from the workout?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => void handleConfirmDeleteSetTemplate()}
          onCancel={() => setPendingDeleteTemplateSetRowId(null)}
        />

        <ConfirmDialog
          open={removeExerciseTemplateGroupKey != null}
          title="Remove exercise"
          message={(() => {
            const gk = removeExerciseTemplateGroupKey;
            if (!gk) return "";
            const g = editor.groups.find((x) => x.groupKey === gk);
            const rows = g?.rows ?? [];
            const savedCount = rows.filter((r) => r.persistedSetId).length;
            const name = g?.exerciseName ?? "this exercise";
            return savedCount > 0
              ? `Remove ${name} from this workout and delete its ${savedCount} saved set(s)?`
              : `Remove ${name} from this workout?`;
          })()}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => void handleConfirmRemoveExerciseTemplate()}
          onCancel={() => setRemoveExerciseTemplateGroupKey(null)}
        />

        <ConfirmDialog
          open={deleteWorkoutConfirm}
          title="Delete workout"
          message="This will permanently delete this workout and all its sets. Continue?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => void handleDeleteWorkout()}
          onCancel={() => setDeleteWorkoutConfirm(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate("/workouts")}
          className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700"
        >
          Back to History
        </button>
      </div>

      <div className="rounded-xl border-l-4 border-indigo-500 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="font-medium text-gray-900">{workout.dayNameSnapshot}</p>
          <button
            type="button"
            onClick={() => setDeleteWorkoutConfirm(true)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-600 hover:bg-red-100"
            aria-label="Delete workout"
            title="Delete workout"
          >
            <IconTrash className="size-6" />
          </button>
        </div>
        {editingDate ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="datetime-local"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="min-h-[44px] rounded-lg border border-gray-300 px-3"
            />
            <button
              type="button"
              onClick={() => void saveDate()}
              className="min-h-[44px] rounded-lg bg-indigo-600 px-3 text-sm text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingDate(false)}
              className="min-h-[44px] text-sm text-gray-500"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingDate(true)}
            className="mt-1 text-sm text-gray-500 hover:underline"
          >
            {formatDate(workout.date)}
          </button>
        )}
        <input
          type="text"
          placeholder="Add a note (optional)"
          value={workout.note ?? ""}
          onChange={(e) =>
            setWorkout((prev) =>
              prev ? { ...prev, note: e.target.value } : null
            )
          }
          onBlur={(e) => void saveNote(e.target.value)}
          className="mt-2 min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {editor.groups.map((group) => (
        <ExerciseCard
          key={group.groupKey}
          exerciseName={group.exerciseName}
          exerciseId={group.exerciseId}
          onRemove={() => setRemoveExerciseGroupKey(group.groupKey)}
          onAddSet={() => editor.addSet(group.groupKey)}
        >
          {group.rows.map((row) => {
            const api = editor.getRowApi(row.id);
            return (
              <SetRow
                key={row.id}
                reps={row.reps}
                weight={row.weight}
                note={row.note}
                onRepsChange={(val) => api.setField("reps", val)}
                onWeightChange={(val) => api.setField("weight", val)}
                onNoteChange={(val) => api.setField("note", val)}
                onBlur={() => void api.flush()}
                onDelete={() => removeWorkoutSetRow(row)}
              />
            );
          })}
        </ExerciseCard>
      ))}

      <button
        type="button"
        onClick={() => setAddExerciseOpen(true)}
        className="min-h-[44px] w-full rounded-xl border border-dashed border-gray-400 bg-white font-medium text-gray-700 hover:border-indigo-500 hover:bg-indigo-100 hover:text-indigo-700"
      >
        + Add exercise
      </button>

      <AddExerciseModal
        open={addExerciseOpen}
        onClose={() => setAddExerciseOpen(false)}
        onAdd={handleAddExercise}
      />

      <ConfirmDialog
        open={deleteSetRowId != null}
        title="Delete set"
        message="Remove this set from the workout?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleConfirmDeleteSet()}
        onCancel={() => setDeleteSetRowId(null)}
      />

      <ConfirmDialog
        open={removeExerciseGroupKey != null}
        title="Remove exercise"
        message={(() => {
          const gk = removeExerciseGroupKey;
          if (!gk) return "";
          const g = editor.groups.find((x) => x.groupKey === gk);
          const rows = g?.rows ?? [];
          const savedCount = rows.filter((r) => r.persistedSetId).length;
          const name = g?.exerciseName ?? "this exercise";
          return savedCount > 0
            ? `Remove ${name} from this workout and delete its ${savedCount} set(s)?`
            : `Remove ${name} from this workout?`;
        })()}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleConfirmRemoveExercise()}
        onCancel={() => setRemoveExerciseGroupKey(null)}
      />

      <ConfirmDialog
        open={deleteWorkoutConfirm}
        title="Delete workout"
        message="This will permanently delete this workout and all its sets. Continue?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteWorkout()}
        onCancel={() => setDeleteWorkoutConfirm(false)}
      />
    </div>
  );
}

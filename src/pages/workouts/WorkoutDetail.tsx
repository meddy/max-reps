import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getDocRef,
  getCollectionRef,
  getDoc,
  getDocs,
  createDoc,
  updateDocById,
  deleteDocAndRelated,
  deleteDocById,
  query,
  where,
  orderBy,
  limit,
} from "../../lib/firestore";
import type { Workout, WorkoutSet } from "../../types";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ExerciseCard } from "../../components/ExerciseCard";
import { SetRow } from "../../components/SetRow";
import { AddExerciseModal } from "../../components/AddExerciseModal";
import { Timestamp } from "firebase/firestore";
import { formatDate, formatDateTime } from "../../lib/format";

type SetWithId = WorkoutSet & { id: string };

type SetRowData = {
  key: string;
  id?: string;
  reps: number;
  weight: number;
  note: string;
};

type ExerciseGroup = {
  exerciseId: string;
  exerciseName: string;
};

function buildStateFromSets(sets: SetWithId[]): {
  exerciseGroups: ExerciseGroup[];
  setsByExercise: Record<string, SetRowData[]>;
} {
  const exerciseGroups: ExerciseGroup[] = [];
  const seen = new Set<string>();
  const setsByExercise: Record<string, SetRowData[]> = {};

  for (const s of sets) {
    if (!seen.has(s.exerciseId)) {
      seen.add(s.exerciseId);
      exerciseGroups.push({
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseNameSnapshot,
      });
    }
    if (!setsByExercise[s.exerciseId]) setsByExercise[s.exerciseId] = [];
    setsByExercise[s.exerciseId].push({
      key: s.id,
      id: s.id,
      reps: s.reps,
      weight: s.weight,
      note: s.note ?? "",
    });
  }
  return { exerciseGroups, setsByExercise };
}

export function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<(Workout & { id: string }) | null>(
    null
  );
  const [exerciseGroups, setExerciseGroups] = useState<ExerciseGroup[]>([]);
  const [setsByExercise, setSetsByExercise] = useState<
    Record<string, SetRowData[]>
  >({});
  const nextOrderRef = useRef(0);
  const setsByExerciseRef = useRef<Record<string, SetRowData[]>>({});
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [deleteSetKey, setDeleteSetKey] = useState<string | null>(null);
  const [deleteSetExerciseId, setDeleteSetExerciseId] = useState<string | null>(
    null
  );
  const [deleteSetRowIndex, setDeleteSetRowIndex] = useState<number | null>(
    null
  );
  const [removeExerciseConfirmId, setRemoveExerciseConfirmId] = useState<
    string | null
  >(null);
  const [deleteWorkoutConfirm, setDeleteWorkoutConfirm] = useState(false);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);

  useEffect(() => {
    setsByExerciseRef.current = setsByExercise;
  }, [setsByExercise]);

  const loadWorkout = useCallback(async () => {
    if (!id) return;
    const snap = await getDoc(getDocRef("workouts", id));
    if (!snap.exists()) {
      setWorkout(null);
      setLoading(false);
      return;
    }
    const w = { id: snap.id, ...snap.data() } as Workout & { id: string };
    setWorkout(w);
    setDateInput(formatDateTime(w.date));
    setLoading(false);
  }, [id]);

  const loadSets = useCallback(async () => {
    if (!id) return;
    const q = query(
      getCollectionRef("sets"),
      where("workoutId", "==", id),
      orderBy("order"),
      limit(500)
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as SetWithId[];
    const { exerciseGroups: groups, setsByExercise: byEx } =
      buildStateFromSets(list);
    setExerciseGroups(groups);
    setSetsByExercise(byEx);
    nextOrderRef.current = list.length;
  }, [id]);

  useEffect(() => {
    void loadWorkout();
  }, [loadWorkout]);

  useEffect(() => {
    void loadSets();
  }, [loadSets]);

  const saveDate = async () => {
    if (!workout || !dateInput) return;
    const date = new Date(dateInput);
    await updateDocById("workouts", workout.id, {
      date: Timestamp.fromDate(date),
    });
    setWorkout((prev) =>
      prev ? { ...prev, date: Timestamp.fromDate(date) } : null
    );
    setEditingDate(false);
  };

  const updateSetRow = (
    exerciseId: string,
    rowIndex: number,
    updates: Partial<Pick<SetRowData, "reps" | "weight" | "note">>
  ) => {
    setSetsByExercise((prev) => {
      const rows = [...(prev[exerciseId] ?? [])];
      rows[rowIndex] = { ...rows[rowIndex], ...updates };
      return { ...prev, [exerciseId]: rows };
    });
  };

  const persistSet = useCallback(
    (exerciseId: string, rowIndex: number) => {
      const rows = setsByExerciseRef.current[exerciseId] ?? [];
      const row = rows[rowIndex];
      if (!row) return;
      if (row.id) {
        void updateDocById("sets", row.id, {
          reps: row.reps,
          weight: row.weight,
          note: row.note,
        });
        return;
      }
      if (row.reps <= 0) return;
      if (!id || !workout) return;
      const exGroup = exerciseGroups.find((g) => g.exerciseId === exerciseId);
      const exerciseName = exGroup?.exerciseName ?? "—";
      const order = nextOrderRef.current++;
      createDoc("sets", {
        workoutId: id,
        exerciseId,
        exerciseNameSnapshot: exerciseName,
        reps: row.reps,
        weight: row.weight,
        unit: "lbs",
        note: row.note,
        performedAt: workout.date,
        order,
      } as unknown as Omit<WorkoutSet, "id" | "createdAt">).then((newId) => {
        setSetsByExercise((prev) => {
          const rows = [...(prev[exerciseId] ?? [])];
          rows[rowIndex] = { ...rows[rowIndex], id: newId, key: newId };
          return { ...prev, [exerciseId]: rows };
        });
      });
    },
    [id, workout, exerciseGroups]
  );

  const addSetRow = (exerciseId: string) => {
    setSetsByExercise((prev) => ({
      ...prev,
      [exerciseId]: [
        ...(prev[exerciseId] ?? []),
        {
          key: crypto.randomUUID(),
          reps: 0,
          weight: 0,
          note: "",
        },
      ],
    }));
  };

  const removeSetRow = (
    exerciseId: string,
    rowIndex: number,
    row: SetRowData
  ) => {
    if (row.id) {
      setDeleteSetKey(row.id);
      setDeleteSetExerciseId(exerciseId);
      setDeleteSetRowIndex(rowIndex);
      return;
    }
    setSetsByExercise((prev) => {
      const rows = [...(prev[exerciseId] ?? [])];
      rows.splice(rowIndex, 1);
      return { ...prev, [exerciseId]: rows };
    });
  };

  const handleConfirmDeleteSet = async () => {
    if (!deleteSetKey || !deleteSetExerciseId || deleteSetRowIndex === null)
      return;
    await deleteDocById("sets", deleteSetKey);
    setSetsByExercise((prev) => {
      const rows = [...(prev[deleteSetExerciseId] ?? [])];
      rows.splice(deleteSetRowIndex, 1);
      return { ...prev, [deleteSetExerciseId]: rows };
    });
    setDeleteSetKey(null);
    setDeleteSetExerciseId(null);
    setDeleteSetRowIndex(null);
  };

  const removeExerciseFromView = (exerciseId: string) => {
    setRemoveExerciseConfirmId(exerciseId);
  };

  const handleConfirmRemoveExercise = async () => {
    const exerciseId = removeExerciseConfirmId;
    if (!exerciseId) return;
    const rows = setsByExercise[exerciseId] ?? [];
    for (const row of rows) {
      if (row.id) await deleteDocById("sets", row.id);
    }
    setExerciseGroups((prev) =>
      prev.filter((g) => g.exerciseId !== exerciseId)
    );
    setSetsByExercise((prev) => {
      const next = { ...prev };
      delete next[exerciseId];
      return next;
    });
    setRemoveExerciseConfirmId(null);
  };

  const handleAddExercise = useCallback(
    (exerciseId: string, exerciseName: string) => {
      if (exerciseGroups.some((g) => g.exerciseId === exerciseId)) return;
      setExerciseGroups((prev) => [...prev, { exerciseId, exerciseName }]);
      setSetsByExercise((prev) => ({
        ...prev,
        [exerciseId]: [
          {
            key: crypto.randomUUID(),
            reps: 0,
            weight: 0,
            note: "",
          },
        ],
      }));
      setAddExerciseOpen(false);
    },
    [exerciseGroups]
  );

  const handleDeleteWorkout = async () => {
    if (!id) return;
    await deleteDocAndRelated("workouts", id, [
      { collection: "sets", field: "workoutId" },
    ]);
    setDeleteWorkoutConfirm(false);
    navigate("/workouts");
  };

  if (loading && !workout) {
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
          Back to history
        </button>
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
          Back
        </button>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="font-medium text-gray-900">{workout.dayNameSnapshot}</p>
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
      </div>

      {exerciseGroups.map((group) => {
        const rows = setsByExercise[group.exerciseId] ?? [];
        return (
          <ExerciseCard
            key={group.exerciseId}
            exerciseName={group.exerciseName}
            onRemove={() => removeExerciseFromView(group.exerciseId)}
            onAddSet={() => addSetRow(group.exerciseId)}
          >
            {rows.map((row, idx) => (
              <SetRow
                key={row.key}
                reps={row.reps}
                weight={row.weight}
                note={row.note}
                onRepsChange={(val) =>
                  updateSetRow(group.exerciseId, idx, { reps: val })
                }
                onWeightChange={(val) =>
                  updateSetRow(group.exerciseId, idx, { weight: val })
                }
                onNoteChange={(val) =>
                  updateSetRow(group.exerciseId, idx, { note: val })
                }
                onBlur={() => persistSet(group.exerciseId, idx)}
                onDelete={() => removeSetRow(group.exerciseId, idx, row)}
              />
            ))}
          </ExerciseCard>
        );
      })}

      <button
        type="button"
        onClick={() => setAddExerciseOpen(true)}
        className="min-h-[44px] w-full rounded-xl border border-dashed border-gray-400 bg-white font-medium text-gray-700 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
      >
        + Add exercise
      </button>

      <AddExerciseModal
        open={addExerciseOpen}
        onClose={() => setAddExerciseOpen(false)}
        onAdd={handleAddExercise}
      />

      <button
        type="button"
        onClick={() => setDeleteWorkoutConfirm(true)}
        className="min-h-[44px] rounded-xl border border-red-300 bg-white font-medium text-red-600 hover:bg-red-50"
      >
        Delete workout
      </button>

      <ConfirmDialog
        open={deleteSetKey != null}
        title="Delete set"
        message="Remove this set from the workout?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleConfirmDeleteSet()}
        onCancel={() => {
          setDeleteSetKey(null);
          setDeleteSetExerciseId(null);
          setDeleteSetRowIndex(null);
        }}
      />

      <ConfirmDialog
        open={removeExerciseConfirmId != null}
        title="Remove exercise"
        message={(() => {
          const eid = removeExerciseConfirmId;
          if (!eid) return "";
          const group = exerciseGroups.find((g) => g.exerciseId === eid);
          const rows = setsByExercise[eid] ?? [];
          const savedCount = rows.filter((r) => r.id).length;
          const name = group?.exerciseName ?? "this exercise";
          return savedCount > 0
            ? `Remove ${name} from this workout and delete its ${savedCount} set(s)?`
            : `Remove ${name} from this workout?`;
        })()}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleConfirmRemoveExercise()}
        onCancel={() => setRemoveExerciseConfirmId(null)}
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

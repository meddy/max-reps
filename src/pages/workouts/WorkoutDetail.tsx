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
import type { Workout, WorkoutSet, Exercise } from "../../types";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Timestamp } from "firebase/firestore";
import { formatDate, formatDateTime } from "../../lib/format";

type SetWithId = WorkoutSet & { id: string };

export function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<(Workout & { id: string }) | null>(
    null
  );
  const [sets, setSets] = useState<SetWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [deleteSetId, setDeleteSetId] = useState<string | null>(null);
  const [deleteWorkoutConfirm, setDeleteWorkoutConfirm] = useState(false);
  const [addSetOpen, setAddSetOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseResults, setExerciseResults] = useState<
    Array<Exercise & { id: string }>
  >([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null
  );
  const [newReps, setNewReps] = useState(0);
  const [newWeight, setNewWeight] = useState(0);
  const [newNote, setNewNote] = useState("");
  const setsRef = useRef<SetWithId[]>([]);
  useEffect(() => {
    setsRef.current = sets;
  }, [sets]);

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
    setSets(list);
  }, [id]);

  useEffect(() => {
    void loadWorkout();
  }, [loadWorkout]);

  useEffect(() => {
    void loadSets();
  }, [loadSets]);

  useEffect(() => {
    if (!addSetOpen || !exerciseSearch.trim()) {
      setExerciseResults([]);
      return;
    }
    let ignore = false;
    const term = exerciseSearch.trim().toLowerCase();
    const ref = getCollectionRef("exercises");
    const q = query(
      ref,
      where("nameLower", ">=", term),
      where("nameLower", "<=", term + "\uf8ff"),
      orderBy("nameLower"),
      limit(20)
    );
    getDocs(q).then((snap) => {
      if (ignore) return;
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Array<Exercise & { id: string }>;
      setExerciseResults(list);
    });
    return () => {
      ignore = true;
    };
  }, [addSetOpen, exerciseSearch]);

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

  const updateSetLocal = (
    setId: string,
    updates: { reps?: number; weight?: number; note?: string }
  ) => {
    setSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, ...updates } : s))
    );
  };

  const persistSet = useCallback((setId: string) => {
    const s = setsRef.current.find((x) => x.id === setId);
    if (!s) return;
    void updateDocById("sets", setId, {
      reps: s.reps,
      weight: s.weight,
      note: s.note,
    });
  }, []);

  const handleDeleteSet = async () => {
    if (!deleteSetId) return;
    await deleteDocById("sets", deleteSetId);
    setDeleteSetId(null);
    void loadSets();
  };

  const handleDeleteWorkout = async () => {
    if (!id) return;
    await deleteDocAndRelated("workouts", id, [
      { collection: "sets", field: "workoutId" },
    ]);
    setDeleteWorkoutConfirm(false);
    navigate("/workouts");
  };

  const handleAddSet = async () => {
    if (!id || !workout || !selectedExerciseId) return;
    const exSnap = await getDoc(getDocRef("exercises", selectedExerciseId));
    const exerciseName = exSnap.exists()
      ? (exSnap.data() as Exercise).displayName
      : "—";
    const nextOrder = sets.length;
    await createDoc("sets", {
      workoutId: id,
      exerciseId: selectedExerciseId,
      exerciseNameSnapshot: exerciseName,
      reps: newReps,
      weight: newWeight,
      unit: "lbs",
      note: newNote,
      performedAt: workout.date,
      order: nextOrder,
    } as unknown as Omit<WorkoutSet, "id" | "createdAt">);
    setAddSetOpen(false);
    setSelectedExerciseId(null);
    setNewReps(0);
    setNewWeight(0);
    setNewNote("");
    void loadSets();
  };

  const groups = sets.reduce<Record<string, SetWithId[]>>((acc, s) => {
    const name = s.exerciseNameSnapshot;
    if (!acc[name]) acc[name] = [];
    acc[name].push(s);
    return acc;
  }, {});

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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAddSetOpen(true)}
          className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Add set
        </button>
      </div>

      {Object.entries(groups).map(([name, groupSets]) => (
        <div key={name} className="rounded-xl bg-white shadow-sm">
          <h3 className="border-b border-gray-100 px-4 py-2 font-medium text-gray-900">
            {name}
          </h3>
          <ul className="divide-y divide-gray-100">
            {groupSets.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-2 px-4 py-2"
              >
                <input
                  type="number"
                  min={0}
                  className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                  value={s.reps}
                  onChange={(e) =>
                    updateSetLocal(s.id, {
                      reps: Number(e.target.value) || 0,
                    })
                  }
                  onBlur={() => persistSet(s.id)}
                />
                <span className="text-gray-500">×</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
                  value={s.weight}
                  onChange={(e) =>
                    updateSetLocal(s.id, {
                      weight: Number(e.target.value) || 0,
                    })
                  }
                  onBlur={() => persistSet(s.id)}
                />
                <span className="text-sm text-gray-500">lbs</span>
                <input
                  type="text"
                  placeholder="Note"
                  className="min-w-[80px] flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                  value={s.note}
                  onChange={(e) =>
                    updateSetLocal(s.id, { note: e.target.value })
                  }
                  onBlur={() => persistSet(s.id)}
                />
                <button
                  type="button"
                  onClick={() => setDeleteSetId(s.id)}
                  className="text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setDeleteWorkoutConfirm(true)}
        className="min-h-[44px] rounded-xl border border-red-300 bg-white font-medium text-red-600 hover:bg-red-50"
      >
        Delete workout
      </button>

      {addSetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Add set</h3>
            <input
              type="text"
              placeholder="Search exercises"
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              className="mt-3 min-h-[44px] w-full rounded-xl border border-gray-300 px-4"
            />
            <ul className="mt-2 max-h-40 overflow-auto">
              {exerciseResults.map((ex) => (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedExerciseId(ex.id)}
                    className={`min-h-[44px] w-full rounded-lg px-3 text-left text-sm ${
                      selectedExerciseId === ex.id
                        ? "bg-indigo-100 font-medium text-indigo-900"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {ex.displayName}
                  </button>
                </li>
              ))}
            </ul>
            {selectedExerciseId && (
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-sm">
                  Reps:{" "}
                  <input
                    type="number"
                    min={0}
                    value={newReps || ""}
                    onChange={(e) => setNewReps(Number(e.target.value) || 0)}
                    className="ml-2 w-16 rounded border px-2 py-1"
                  />
                </label>
                <label className="text-sm">
                  Weight:{" "}
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={newWeight || ""}
                    onChange={(e) => setNewWeight(Number(e.target.value) || 0)}
                    className="ml-2 w-20 rounded border px-2 py-1"
                  />{" "}
                  lbs
                </label>
                <input
                  type="text"
                  placeholder="Note"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddSetOpen(false);
                      setSelectedExerciseId(null);
                    }}
                    className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white font-medium text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAddSet()}
                    className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-500"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteSetId != null}
        title="Delete set"
        message="Remove this set from the workout?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteSet()}
        onCancel={() => setDeleteSetId(null)}
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

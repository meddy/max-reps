import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getDocRef,
  getCollectionRef,
  getDoc,
  getDocs,
  createDoc,
  updateDocById,
  deleteDocById,
  query,
  where,
  orderBy,
  limit,
} from "../../lib/firestore";
import type { Day, Exercise, ExerciseSetTemplate } from "../../types";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState } from "../../components/EmptyState";

export function DayDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [day, setDay] = useState<(Day & { id: string }) | null>(null);
  const [templates, setTemplates] = useState<
    Array<ExerciseSetTemplate & { id: string; exerciseName?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseResults, setExerciseResults] = useState<
    Array<Exercise & { id: string }>
  >([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null
  );
  const [newNumSets, setNewNumSets] = useState(3);
  const [newRepsLower, setNewRepsLower] = useState(8);
  const [newRepsUpper, setNewRepsUpper] = useState(12);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null
  );
  const [editNumSets, setEditNumSets] = useState(0);
  const [editRepsLower, setEditRepsLower] = useState(0);
  const [editRepsUpper, setEditRepsUpper] = useState(0);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const loadDay = useCallback(async () => {
    if (!id) return;
    const docSnap = await getDoc(getDocRef("days", id));
    if (!docSnap.exists()) {
      setDay(null);
      setLoading(false);
      return;
    }
    setDay({
      id: docSnap.id,
      ...docSnap.data(),
    } as Day & { id: string });
    setLoading(false);
  }, [id]);

  const loadTemplates = useCallback(async () => {
    if (!id) return;
    const ref = getCollectionRef("exerciseSetTemplates");
    const q = query(
      ref,
      where("dayId", "==", id),
      orderBy("order"),
      limit(100)
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Array<ExerciseSetTemplate & { id: string }>;
    const exerciseIds = [...new Set(list.map((t) => t.exerciseId))];
    const exercisesSnap = await Promise.all(
      exerciseIds.map((eid) => getDoc(getDocRef("exercises", eid)))
    );
    const nameMap: Record<string, string> = {};
    exercisesSnap.forEach((s, i) => {
      if (s.exists() && exerciseIds[i]) {
        nameMap[exerciseIds[i]] = (s.data() as Exercise).displayName;
      }
    });
    setTemplates(
      list.map((t) => ({
        ...t,
        exerciseName: nameMap[t.exerciseId] ?? "—",
      }))
    );
  }, [id]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!addOpen || !exerciseSearch.trim()) {
      setExerciseResults([]);
      return;
    }
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
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Array<Exercise & { id: string }>;
      setExerciseResults(list);
    });
  }, [addOpen, exerciseSearch]);

  const handleAddTemplate = async () => {
    if (!id || !selectedExerciseId) return;
    const maxOrder =
      templates.length > 0
        ? Math.max(...templates.map((t) => t.order))
        : -1;
    await createDoc("exerciseSetTemplates", {
      dayId: id,
      exerciseId: selectedExerciseId,
      numSets: newNumSets,
      repsLower: newRepsLower,
      repsUpper: newRepsUpper,
      order: maxOrder + 1,
    } as unknown as Omit<
      ExerciseSetTemplate,
      "id" | "createdAt" | "updatedAt"
    >);
    setAddOpen(false);
    setSelectedExerciseId(null);
    setExerciseSearch("");
    setNewNumSets(3);
    setNewRepsLower(8);
    setNewRepsUpper(12);
    void loadTemplates();
  };

  const handleSaveEdit = async () => {
    if (!editingTemplateId) return;
    await updateDocById("exerciseSetTemplates", editingTemplateId, {
      numSets: editNumSets,
      repsLower: editRepsLower,
      repsUpper: editRepsUpper,
    });
    setEditingTemplateId(null);
    void loadTemplates();
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;
    await deleteDocById("exerciseSetTemplates", deleteTemplateId);
    setDeleteTemplateId(null);
    void loadTemplates();
  };

  const moveTemplate = async (index: number, direction: "up" | "down") => {
    const newOrder = direction === "up" ? index - 1 : index + 1;
    if (newOrder < 0 || newOrder >= templates.length) return;
    const a = templates[index];
    const b = templates[newOrder];
    await Promise.all([
      updateDocById("exerciseSetTemplates", a.id, { order: newOrder }),
      updateDocById("exerciseSetTemplates", b.id, { order: index }),
    ]);
    void loadTemplates();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!day) {
    return (
      <div>
        <p className="text-gray-500">Day not found.</p>
        <button
          type="button"
          onClick={() => navigate("/days")}
          className="mt-2 text-indigo-600 hover:underline"
        >
          Back to days
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">
          {day.displayName}
        </h2>
        <button
          type="button"
          onClick={() => navigate("/days")}
          className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setAddOpen(true);
            setSelectedExerciseId(null);
            setExerciseSearch("");
          }}
          className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Add exercise
        </button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No exercises in this day"
          description="Add exercises to build your template."
          action={
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Add exercise
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map((t, index) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-medium text-gray-900">{t.exerciseName}</p>
                <p className="text-sm text-gray-500">
                  {editingTemplateId === t.id ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={editNumSets}
                        onChange={(e) =>
                          setEditNumSets(Number(e.target.value) || 1)
                        }
                        className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      sets ×
                      <input
                        type="number"
                        min={0}
                        value={editRepsLower}
                        onChange={(e) =>
                          setEditRepsLower(Number(e.target.value) || 0)
                        }
                        className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      –
                      <input
                        type="number"
                        min={0}
                        value={editRepsUpper}
                        onChange={(e) =>
                          setEditRepsUpper(Number(e.target.value) || 0)
                        }
                        className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      reps
                    </span>
                  ) : (
                    `${t.numSets} × ${t.repsLower}–${t.repsUpper} reps`
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {editingTemplateId === t.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit()}
                      className="min-h-[44px] rounded-lg px-2 text-sm text-indigo-600 hover:bg-indigo-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTemplateId(null)}
                      className="min-h-[44px] rounded-lg px-2 text-sm text-gray-500"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => moveTemplate(index, "up")}
                      disabled={index === 0}
                      className="min-h-[44px] min-w-[44px] rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTemplate(index, "down")}
                      disabled={index === templates.length - 1}
                      className="min-h-[44px] min-w-[44px] rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTemplateId(t.id);
                        setEditNumSets(t.numSets);
                        setEditRepsLower(t.repsLower);
                        setEditRepsUpper(t.repsUpper);
                      }}
                      className="min-h-[44px] rounded-lg px-2 text-sm text-gray-500 hover:bg-gray-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTemplateId(t.id)}
                      className="min-h-[44px] rounded-lg px-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-sm overflow-auto rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">
              Add exercise to day
            </h3>
            <input
              type="text"
              placeholder="Search exercises"
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              className="mt-3 min-h-[44px] w-full rounded-xl border border-gray-300 px-4 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                <label className="text-sm text-gray-600">
                  Sets:{" "}
                  <input
                    type="number"
                    min={1}
                    value={newNumSets}
                    onChange={(e) =>
                      setNewNumSets(Number(e.target.value) || 1)
                    }
                    className="ml-2 w-16 rounded border border-gray-300 px-2 py-1"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  Rep range:{" "}
                  <input
                    type="number"
                    min={0}
                    value={newRepsLower}
                    onChange={(e) =>
                      setNewRepsLower(Number(e.target.value) || 0)
                    }
                    className="mx-1 w-14 rounded border border-gray-300 px-2 py-1"
                  />
                  –
                  <input
                    type="number"
                    min={0}
                    value={newRepsUpper}
                    onChange={(e) =>
                      setNewRepsUpper(Number(e.target.value) || 0)
                    }
                    className="mx-1 w-14 rounded border border-gray-300 px-2 py-1"
                  />
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddOpen(false);
                      setSelectedExerciseId(null);
                    }}
                    className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white font-medium text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAddTemplate()}
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
        open={deleteTemplateId != null}
        title="Remove exercise"
        message="Remove this exercise from the day template?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteTemplate()}
        onCancel={() => setDeleteTemplateId(null)}
      />
    </div>
  );
}

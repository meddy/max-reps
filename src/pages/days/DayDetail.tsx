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
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState } from "../../components/EmptyState";
import { IconPencil, IconTrash } from "../../components/Icons";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Modal } from "../../components/Modal";

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
  const [selectedExerciseDisplayName, setSelectedExerciseDisplayName] =
    useState<string | null>(null);
  const [createExerciseError, setCreateExerciseError] = useState("");
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
  }, [addOpen, exerciseSearch]);

  const handleCreateExercise = async () => {
    const displayName = exerciseSearch.trim();
    if (!displayName) return;
    setCreateExerciseError("");
    const nameLower = displayName.toLowerCase();
    const ref = getCollectionRef("exercises");
    const existing = await getDocs(
      query(ref, where("nameLower", "==", nameLower))
    );
    if (!existing.empty) {
      setCreateExerciseError("An exercise with this name already exists");
      return;
    }
    const newId = await createDoc("exercises", {
      nameLower,
      displayName,
    } as unknown as Omit<Exercise, "id" | "createdAt" | "updatedAt">);
    setSelectedExerciseId(newId);
    setSelectedExerciseDisplayName(displayName);
    setExerciseSearch("");
  };

  const handleAddTemplate = async () => {
    if (!id || !selectedExerciseId) return;
    const maxOrder =
      templates.length > 0 ? Math.max(...templates.map((t) => t.order)) : -1;
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
    setSelectedExerciseDisplayName(null);
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
            setSelectedExerciseDisplayName(null);
            setExerciseSearch("");
            setCreateExerciseError("");
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
                        max={editRepsUpper}
                        value={editRepsLower}
                        onChange={(e) =>
                          setEditRepsLower(
                            Math.min(Number(e.target.value) || 0, editRepsUpper)
                          )
                        }
                        className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      –
                      <input
                        type="number"
                        min={editRepsLower}
                        value={editRepsUpper}
                        onChange={(e) =>
                          setEditRepsUpper(
                            Math.max(Number(e.target.value) || 0, editRepsLower)
                          )
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
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                      aria-label="Edit template"
                      title="Edit template"
                    >
                      <IconPencil className="size-6" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTemplateId(t.id)}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                      aria-label="Delete template"
                      title="Delete template"
                    >
                      <IconTrash className="size-6" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setSelectedExerciseId(null);
          setSelectedExerciseDisplayName(null);
          setExerciseSearch("");
          setCreateExerciseError("");
        }}
        title="Add exercise to day"
      >
        {selectedExerciseId ? (
          <div className="mt-3 flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 px-4">
            <span className="flex-1 truncate text-sm font-medium text-gray-900">
              {selectedExerciseDisplayName ??
                exerciseResults.find((e) => e.id === selectedExerciseId)
                  ?.displayName ??
                "—"}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedExerciseId(null);
                setSelectedExerciseDisplayName(null);
                setExerciseSearch("");
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              aria-label="Clear selection"
            >
              <span className="text-sm">✕</span>
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              placeholder="Search exercises"
              value={exerciseSearch}
              onChange={(e) => {
                setExerciseSearch(e.target.value);
                setCreateExerciseError("");
              }}
              className="mt-3 min-h-[44px] w-full rounded-xl border border-gray-300 px-4 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <ul className="mt-2 max-h-40 overflow-auto">
              {exerciseResults.map((ex) => (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedExerciseId(ex.id);
                      setSelectedExerciseDisplayName(ex.displayName);
                    }}
                    className="min-h-[44px] w-full rounded-lg px-3 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {ex.displayName}
                  </button>
                </li>
              ))}
            </ul>
            {exerciseSearch.trim() !== "" && exerciseResults.length === 0 && (
              <div className="mt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleCreateExercise()}
                  className="min-h-[44px] w-full rounded-xl border border-dashed border-gray-400 bg-gray-50 font-medium text-gray-700 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  Create exercise &ldquo;{exerciseSearch.trim()}&rdquo;
                </button>
                {createExerciseError && (
                  <p className="text-sm text-red-600">{createExerciseError}</p>
                )}
              </div>
            )}
          </>
        )}
        {selectedExerciseId && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="grid grid-cols-[minmax(5rem,auto)_1fr] items-center gap-x-3 gap-y-2">
              <label className="text-sm text-gray-600" htmlFor="add-num-sets">
                Sets:
              </label>
              <input
                id="add-num-sets"
                type="number"
                min={1}
                value={newNumSets}
                onChange={(e) => setNewNumSets(Number(e.target.value) || 1)}
                className="w-16 rounded border border-gray-300 px-2 py-1"
              />
              <label className="text-sm text-gray-600" htmlFor="add-reps-lower">
                Rep range:
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="add-reps-lower"
                  type="number"
                  min={0}
                  max={newRepsUpper}
                  value={newRepsLower}
                  onChange={(e) =>
                    setNewRepsLower(
                      Math.min(Number(e.target.value) || 0, newRepsUpper)
                    )
                  }
                  className="w-14 rounded border border-gray-300 px-2 py-1"
                />
                <span className="text-gray-500">–</span>
                <input
                  id="add-reps-upper"
                  type="number"
                  min={newRepsLower}
                  value={newRepsUpper}
                  onChange={(e) =>
                    setNewRepsUpper(
                      Math.max(Number(e.target.value) || 0, newRepsLower)
                    )
                  }
                  className="w-14 rounded border border-gray-300 px-2 py-1"
                />
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  setSelectedExerciseId(null);
                  setSelectedExerciseDisplayName(null);
                  setExerciseSearch("");
                  setCreateExerciseError("");
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
      </Modal>

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

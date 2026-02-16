import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  setDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
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
import { db } from "../../lib/firebase";
import type {
  Day,
  Exercise,
  ExerciseSetTemplate,
  WorkoutSet,
} from "../../types";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Modal } from "../../components/Modal";

type TemplateWithName = ExerciseSetTemplate & {
  id: string;
  exerciseName: string;
  isAdHoc?: boolean;
};

type SetDraft = {
  draftId: string;
  reps: number;
  weight: number;
  note: string;
  savedId?: string;
};

export function CreateWorkout() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"day" | "logging" | "done">("day");
  const [daySearch, setDaySearch] = useState("");
  const [dayResults, setDayResults] = useState<Array<Day & { id: string }>>([]);
  const [selectedDay, setSelectedDay] = useState<(Day & { id: string }) | null>(
    null
  );
  const [workoutDate, setWorkoutDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [workoutPerformedAt, setWorkoutPerformedAt] =
    useState<Timestamp | null>(null);
  const nextSetOrderRef = useRef(0);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );
  const setsByExerciseRef = useRef<Record<string, SetDraft[]>>({});
  const [templates, setTemplates] = useState<TemplateWithName[]>([]);
  const [setsByExercise, setSetsByExercise] = useState<
    Record<string, SetDraft[]>
  >({});
  const [lastPerformed, setLastPerformed] = useState<
    Record<string, { reps: number; weight: number; note?: string }>
  >({});
  const [loading, setLoading] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [deleteSetConfirm, setDeleteSetConfirm] = useState<{
    setId: string;
    templateId: string;
    rowIndex: number;
  } | null>(null);
  const [removeExerciseConfirmTemplateId, setRemoveExerciseConfirmTemplateId] =
    useState<string | null>(null);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
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

  useEffect(() => {
    setsByExerciseRef.current = setsByExercise;
  }, [setsByExercise]);

  useEffect(() => {
    return () => {
      for (const key of Object.keys(debounceTimers.current)) {
        clearTimeout(debounceTimers.current[key]);
      }
      debounceTimers.current = {};
    };
  }, []);

  useEffect(() => {
    if (step !== "day" || !daySearch.trim()) {
      setDayResults([]);
      return;
    }
    let ignore = false;
    const term = daySearch.trim().toLowerCase();
    const ref = getCollectionRef("days");
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
      })) as Array<Day & { id: string }>;
      setDayResults(list);
    });
    return () => {
      ignore = true;
    };
  }, [step, daySearch]);

  useEffect(() => {
    if (!addExerciseOpen || !exerciseSearch.trim()) {
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
  }, [addExerciseOpen, exerciseSearch]);

  const selectDay = useCallback(
    async (day: Day & { id: string }) => {
      setLoading(true);
      setSelectedDay(day);
      const date = new Date(workoutDate + "T12:00:00");
      const workoutRef = doc(collection(db, "workouts"));
      const id = workoutRef.id;

      const templatesRef = getCollectionRef("exerciseSetTemplates");
      const tq = query(
        templatesRef,
        where("dayId", "==", day.id),
        orderBy("order"),
        limit(100)
      );
      const [_, tSnap] = await Promise.all([
        setDoc(workoutRef, {
          date: Timestamp.fromDate(date),
          dayId: day.id,
          dayNameSnapshot: day.displayName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        getDocs(tq),
      ]);
      setWorkoutId(id);
      setWorkoutPerformedAt(Timestamp.fromDate(date));
      nextSetOrderRef.current = 0;

      const tList = tSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Array<ExerciseSetTemplate & { id: string }>;
      const exerciseIds = [...new Set(tList.map((t) => t.exerciseId))];
      const names: Record<string, string> = {};
      await Promise.all(
        exerciseIds.map(async (eid) => {
          const snap = await getDoc(getDocRef("exercises", eid));
          if (snap.exists()) names[eid] = (snap.data() as Exercise).displayName;
        })
      );
      const withNames: TemplateWithName[] = tList.map((t) => ({
        ...t,
        exerciseName: names[t.exerciseId] ?? "—",
      }));
      setTemplates(withNames);

      const initialSets: Record<string, SetDraft[]> = {};
      for (const t of withNames) {
        initialSets[t.id] = Array.from({ length: t.numSets }, () => ({
          draftId: crypto.randomUUID(),
          reps: 0,
          weight: 0,
          note: "",
        }));
      }

      const lastResults = await Promise.all(
        withNames.map(async (t) => {
          const setsRef = getCollectionRef("sets");
          const sq = query(
            setsRef,
            where("exerciseId", "==", t.exerciseId),
            orderBy("performedAt", "desc"),
            limit(1)
          );
          const sSnap = await getDocs(sq);
          if (!sSnap.empty) {
            const d = sSnap.docs[0].data() as WorkoutSet;
            return [
              t.exerciseId,
              { reps: d.reps, weight: d.weight, note: d.note },
            ] as const;
          }
          return [t.exerciseId, null] as const;
        })
      );
      const last: Record<
        string,
        { reps: number; weight: number; note?: string }
      > = {};
      for (const [eid, val] of lastResults) {
        if (val) last[eid] = val;
      }

      setSetsByExercise(initialSets);
      setLastPerformed(last);
      setLoading(false);
      setStep("logging");
    },
    [workoutDate]
  );

  const totalSetCount = Object.values(setsByExercise).reduce(
    (sum, rows) => sum + rows.length,
    0
  );
  const savedSetCount = Object.values(setsByExercise).reduce(
    (sum, rows) => sum + rows.filter((r) => r.savedId).length,
    0
  );

  const addSetRow = (templateId: string) => {
    setSetsByExercise((prev) => ({
      ...prev,
      [templateId]: [
        ...(prev[templateId] ?? []),
        { draftId: crypto.randomUUID(), reps: 0, weight: 0, note: "" },
      ],
    }));
  };

  const removeSetRow = (
    templateId: string,
    rowIndex: number,
    row: SetDraft
  ) => {
    if (debounceTimers.current[row.draftId] != null) {
      clearTimeout(debounceTimers.current[row.draftId]);
      delete debounceTimers.current[row.draftId];
    }
    if (row.savedId) {
      setDeleteSetConfirm({
        setId: row.savedId,
        templateId,
        rowIndex,
      });
      return;
    }
    setSetsByExercise((prev) => {
      const rows = [...(prev[templateId] ?? [])];
      rows.splice(rowIndex, 1);
      return { ...prev, [templateId]: rows };
    });
  };

  const handleConfirmDeleteSet = async () => {
    if (!deleteSetConfirm) return;
    await deleteDocById("sets", deleteSetConfirm.setId);
    setSetsByExercise((prev) => {
      const rows = [...(prev[deleteSetConfirm.templateId] ?? [])];
      rows.splice(deleteSetConfirm.rowIndex, 1);
      return { ...prev, [deleteSetConfirm.templateId]: rows };
    });
    setDeleteSetConfirm(null);
  };

  const removeExerciseFromView = (templateId: string) => {
    setRemoveExerciseConfirmTemplateId(templateId);
  };

  const handleConfirmRemoveExercise = async () => {
    const templateId = removeExerciseConfirmTemplateId;
    if (!templateId) return;
    const rows = setsByExercise[templateId] ?? [];
    for (const r of rows) {
      if (debounceTimers.current[r.draftId] != null) {
        clearTimeout(debounceTimers.current[r.draftId]);
        delete debounceTimers.current[r.draftId];
      }
    }
    const template = templates.find((t) => t.id === templateId);
    const savedIds = rows
      .map((r) => r.savedId)
      .filter((id): id is string => id != null);
    for (const setId of savedIds) {
      await deleteDocById("sets", setId);
    }
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    setSetsByExercise((prev) => {
      const next = { ...prev };
      delete next[templateId];
      return next;
    });
    if (template) {
      setLastPerformed((prev) => {
        const next = { ...prev };
        delete next[template.exerciseId];
        return next;
      });
    }
    setRemoveExerciseConfirmTemplateId(null);
  };

  const updateSetRow = (
    templateId: string,
    rowIndex: number,
    field: keyof SetDraft,
    value: number | string,
    draftId: string,
    template: TemplateWithName
  ) => {
    setSetsByExercise((prev) => {
      const rows = [...(prev[templateId] ?? [])];
      rows[rowIndex] = { ...rows[rowIndex], [field]: value };
      return { ...prev, [templateId]: rows };
    });
    debouncedSave(templateId, draftId, template);
  };

  const saveSet = async (
    templateId: string,
    template: TemplateWithName,
    rowIndex: number,
    draft: SetDraft
  ) => {
    if (!workoutId || !workoutPerformedAt) return;
    if (draft.reps <= 0) return;
    try {
      if (draft.savedId) {
        await updateDocById("sets", draft.savedId, {
          reps: draft.reps,
          weight: draft.weight,
          note: draft.note ?? "",
        });
      } else {
        const order = nextSetOrderRef.current++;
        const id = await createDoc("sets", {
          workoutId,
          exerciseId: template.exerciseId,
          exerciseNameSnapshot: template.exerciseName,
          reps: draft.reps,
          weight: draft.weight,
          unit: "lbs",
          note: draft.note ?? "",
          performedAt: workoutPerformedAt,
          order,
        } as unknown as Omit<WorkoutSet, "id" | "createdAt">);
        setSetsByExercise((prev) => {
          const rows = [...(prev[templateId] ?? [])];
          rows[rowIndex] = { ...rows[rowIndex], savedId: id };
          return { ...prev, [templateId]: rows };
        });
      }
    } catch {
      // silently ignore save errors
    }
  };

  const DEBOUNCE_MS = 800;

  const saveSetRef = useRef(saveSet);
  useEffect(() => {
    saveSetRef.current = saveSet;
  });

  const debouncedSave = useCallback(
    (templateId: string, draftId: string, template: TemplateWithName) => {
      const key = draftId;
      if (debounceTimers.current[key] != null) {
        clearTimeout(debounceTimers.current[key]);
        delete debounceTimers.current[key];
      }
      debounceTimers.current[key] = setTimeout(() => {
        delete debounceTimers.current[key];
        const latest = setsByExerciseRef.current[templateId] ?? [];
        const idx = latest.findIndex((r) => r.draftId === draftId);
        if (idx === -1) return;
        const latestDraft = latest[idx];
        if (latestDraft.reps <= 0) return;
        void saveSetRef.current(templateId, template, idx, latestDraft);
      }, DEBOUNCE_MS);
    },
    []
  );

  const finishWorkout = () => {
    navigate(savedSetCount > 0 ? `/workouts/${workoutId}` : "/workouts");
  };

  const confirmLeave = () => {
    if (savedSetCount === 0 && totalSetCount === 0) {
      setLeaveConfirm(true);
      return;
    }
    if (savedSetCount === 0 && workoutId) {
      setLeaveConfirm(true);
      return;
    }
    navigate("/workouts");
  };

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

  const handleAddExercise = async () => {
    if (!selectedExerciseId || !selectedExerciseDisplayName || !selectedDay)
      return;
    const syntheticId = `adhoc-${crypto.randomUUID()}`;
    const maxOrder =
      templates.length > 0 ? Math.max(...templates.map((t) => t.order)) : -1;
    const now = Timestamp.now();
    const virtualTemplate: TemplateWithName = {
      id: syntheticId,
      dayId: selectedDay.id,
      exerciseId: selectedExerciseId,
      exerciseName: selectedExerciseDisplayName,
      numSets: 1,
      repsLower: 0,
      repsUpper: 0,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      isAdHoc: true,
    };
    setTemplates((prev) => [...prev, virtualTemplate]);
    setSetsByExercise((prev) => ({
      ...prev,
      [syntheticId]: [
        { draftId: crypto.randomUUID(), reps: 0, weight: 0, note: "" },
      ],
    }));
    const setsRef = getCollectionRef("sets");
    const sq = query(
      setsRef,
      where("exerciseId", "==", selectedExerciseId),
      orderBy("performedAt", "desc"),
      limit(1)
    );
    const sSnap = await getDocs(sq);
    if (!sSnap.empty) {
      const d = sSnap.docs[0].data() as WorkoutSet;
      setLastPerformed((prev) => ({
        ...prev,
        [selectedExerciseId]: {
          reps: d.reps,
          weight: d.weight,
          note: d.note,
        },
      }));
    }
    setAddExerciseOpen(false);
    setSelectedExerciseId(null);
    setSelectedExerciseDisplayName(null);
    setExerciseSearch("");
    setCreateExerciseError("");
  };

  const handleConfirmLeave = async () => {
    if (workoutId && savedSetCount === 0) {
      const { writeBatch } = await import("firebase/firestore");
      const setsRef = getCollectionRef("sets");
      const setsSnap = await getDocs(
        query(setsRef, where("workoutId", "==", workoutId))
      );
      const batch = writeBatch(db);
      for (const d of setsSnap.docs) batch.delete(d.ref);
      batch.delete(doc(db, "workouts", workoutId));
      await batch.commit();
    }
    setLeaveConfirm(false);
    navigate("/workouts");
  };

  if (step === "day") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Create Workout</h2>
        <label className="text-sm text-gray-600">
          Date
          <input
            type="date"
            value={workoutDate}
            onChange={(e) => setWorkoutDate(e.target.value)}
            className="ml-2 min-h-[44px] rounded-xl border border-gray-300 px-3"
          />
        </label>
        <label className="text-sm text-gray-600">
          Day template
          <input
            type="search"
            placeholder="Search days..."
            value={daySearch}
            onChange={(e) => setDaySearch(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {dayResults.map((day) => (
              <li key={day.id}>
                <button
                  type="button"
                  onClick={() => void selectDay(day)}
                  className="min-h-[44px] w-full rounded-xl bg-white px-4 text-left font-medium text-gray-900 shadow-sm hover:bg-gray-50"
                >
                  {day.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}
        {daySearch.trim() && dayResults.length === 0 && !loading && (
          <p className="text-sm text-gray-500">
            No days match. Create a day from the Days tab.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {selectedDay?.displayName} — Log sets
        </h2>
        <button
          type="button"
          onClick={confirmLeave}
          className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700"
        >
          Cancel
        </button>
      </div>

      {templates.map((template) => {
        const rows = setsByExercise[template.id] ?? [];
        const last = lastPerformed[template.exerciseId];
        return (
          <div key={template.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900">
                {template.exerciseName}
              </p>
              <button
                type="button"
                onClick={() => removeExerciseFromView(template.id)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50"
                aria-label="Remove exercise"
              >
                <svg
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
            {!template.isAdHoc ? (
              <p className="text-sm text-gray-500">
                Target: {template.repsLower}–{template.repsUpper} reps
                {last && (
                  <span className="ml-2">
                    · Last: {last.reps} × {last.weight} lbs
                  </span>
                )}
              </p>
            ) : (
              last && (
                <p className="text-sm text-gray-500">
                  Last: {last.reps} × {last.weight} lbs
                </p>
              )
            )}
            <ul className="mt-3 flex flex-col gap-6 sm:gap-2">
              {rows.map((row, idx) => (
                <li key={idx} className="flex flex-wrap items-center gap-2">
                  <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto sm:flex-initial">
                    <input
                      type="number"
                      min={0}
                      placeholder="Reps"
                      value={row.reps || ""}
                      onChange={(e) =>
                        updateSetRow(
                          template.id,
                          idx,
                          "reps",
                          Number(e.target.value) || 0,
                          row.draftId,
                          template
                        )
                      }
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm sm:w-20 sm:min-w-[5rem] sm:flex-none"
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="Weight"
                      value={row.weight}
                      onChange={(e) =>
                        updateSetRow(
                          template.id,
                          idx,
                          "weight",
                          Number(e.target.value) || 0,
                          row.draftId,
                          template
                        )
                      }
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm sm:w-24 sm:min-w-[6rem] sm:flex-none"
                    />
                    <span className="text-sm text-gray-500">lbs</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Note"
                    value={row.note}
                    onChange={(e) =>
                      updateSetRow(
                        template.id,
                        idx,
                        "note",
                        e.target.value,
                        row.draftId,
                        template
                      )
                    }
                    className="min-w-0 basis-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm sm:basis-auto sm:flex-1 sm:min-w-[80px]"
                  />
                  <div className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-auto sm:flex-initial">
                    <button
                      type="button"
                      onClick={() => removeSetRow(template.id, idx, row)}
                      className="flex flex-1 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 sm:h-8 sm:w-8 sm:flex-none"
                      aria-label={row.savedId ? "Delete set" : "Remove set"}
                    >
                      <svg
                        className="size-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => addSetRow(template.id)}
              className="mt-2 min-h-[44px] text-sm text-indigo-600 hover:underline"
            >
              + Add set
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => {
          setAddExerciseOpen(true);
          setSelectedExerciseId(null);
          setSelectedExerciseDisplayName(null);
          setExerciseSearch("");
          setCreateExerciseError("");
        }}
        className="min-h-[44px] w-full rounded-xl border border-dashed border-gray-400 bg-white font-medium text-gray-700 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
      >
        + Add exercise
      </button>

      <Modal
        open={addExerciseOpen}
        onClose={() => {
          setAddExerciseOpen(false);
          setSelectedExerciseId(null);
          setSelectedExerciseDisplayName(null);
          setExerciseSearch("");
          setCreateExerciseError("");
        }}
        title="Add exercise to workout"
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
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setAddExerciseOpen(false);
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
              onClick={() => void handleAddExercise()}
              className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-500"
            >
              Add
            </button>
          </div>
        )}
      </Modal>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setLeaveConfirm(true)}
          className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white font-medium text-gray-700"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={finishWorkout}
          className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-500"
        >
          Finish workout
        </button>
      </div>

      <ConfirmDialog
        open={leaveConfirm}
        title="Leave workout?"
        message={
          savedSetCount === 0
            ? "No sets saved. The workout will be deleted. Continue?"
            : "Discard and go back to history?"
        }
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={() => void handleConfirmLeave()}
        onCancel={() => setLeaveConfirm(false)}
      />

      <ConfirmDialog
        open={deleteSetConfirm != null}
        title="Delete set"
        message="Remove this set from the workout?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleConfirmDeleteSet()}
        onCancel={() => setDeleteSetConfirm(null)}
      />

      <ConfirmDialog
        open={removeExerciseConfirmTemplateId != null}
        title="Remove exercise"
        message={(() => {
          const tid = removeExerciseConfirmTemplateId;
          if (!tid) return "";
          const t = templates.find((x) => x.id === tid);
          const rows = setsByExercise[tid] ?? [];
          const savedCount = rows.filter((r) => r.savedId).length;
          const name = t?.exerciseName ?? "this exercise";
          return savedCount > 0
            ? `Remove ${name} from this workout and delete its ${savedCount} saved set(s)?`
            : `Remove ${name} from this workout?`;
        })()}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleConfirmRemoveExercise()}
        onCancel={() => setRemoveExerciseConfirmTemplateId(null)}
      />
    </div>
  );
}

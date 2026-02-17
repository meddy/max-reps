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
import { ExerciseCard } from "../../components/ExerciseCard";
import { SetRow } from "../../components/SetRow";
import { AddExerciseModal } from "../../components/AddExerciseModal";

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

  const handleAddExercise = useCallback(
    async (exerciseId: string, exerciseName: string) => {
      if (!selectedDay) return;
      const syntheticId = `adhoc-${crypto.randomUUID()}`;
      const maxOrder =
        templates.length > 0 ? Math.max(...templates.map((t) => t.order)) : -1;
      const now = Timestamp.now();
      const virtualTemplate: TemplateWithName = {
        id: syntheticId,
        dayId: selectedDay.id,
        exerciseId,
        exerciseName,
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
        where("exerciseId", "==", exerciseId),
        orderBy("performedAt", "desc"),
        limit(1)
      );
      const sSnap = await getDocs(sq);
      if (!sSnap.empty) {
        const d = sSnap.docs[0].data() as WorkoutSet;
        setLastPerformed((prev) => ({
          ...prev,
          [exerciseId]: {
            reps: d.reps,
            weight: d.weight,
            note: d.note,
          },
        }));
      }
      setAddExerciseOpen(false);
    },
    [selectedDay, templates]
  );

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
        const metadata = !template.isAdHoc ? (
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
        );
        return (
          <ExerciseCard
            key={template.id}
            exerciseName={template.exerciseName}
            metadata={metadata}
            onRemove={() => removeExerciseFromView(template.id)}
            onAddSet={() => addSetRow(template.id)}
          >
            {rows.map((row, idx) => (
              <SetRow
                key={row.draftId}
                reps={row.reps}
                weight={row.weight}
                note={row.note}
                onRepsChange={(val) =>
                  updateSetRow(
                    template.id,
                    idx,
                    "reps",
                    val,
                    row.draftId,
                    template
                  )
                }
                onWeightChange={(val) =>
                  updateSetRow(
                    template.id,
                    idx,
                    "weight",
                    val,
                    row.draftId,
                    template
                  )
                }
                onNoteChange={(val) =>
                  updateSetRow(
                    template.id,
                    idx,
                    "note",
                    val,
                    row.draftId,
                    template
                  )
                }
                onDelete={() => removeSetRow(template.id, idx, row)}
                deleteAriaLabel={row.savedId ? "Delete set" : "Remove set"}
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
        onAdd={(exerciseId, exerciseName) =>
          void handleAddExercise(exerciseId, exerciseName)
        }
      />

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

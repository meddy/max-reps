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

type TemplateWithName = ExerciseSetTemplate & {
  id: string;
  exerciseName: string;
};

type SetDraft = {
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
    return d.toISOString().slice(0, 16);
  });
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [workoutPerformedAt, setWorkoutPerformedAt] =
    useState<Timestamp | null>(null);
  const nextSetOrderRef = useRef(0);
  const [templates, setTemplates] = useState<TemplateWithName[]>([]);
  const [setsByExercise, setSetsByExercise] = useState<
    Record<string, SetDraft[]>
  >({});
  const [lastPerformed, setLastPerformed] = useState<
    Record<string, { reps: number; weight: number; note?: string }>
  >({});
  const [loading, setLoading] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

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
      const date = new Date(workoutDate);
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
        { reps: 0, weight: 0, note: "" },
      ],
    }));
  };

  const updateSetRow = (
    templateId: string,
    rowIndex: number,
    field: keyof SetDraft,
    value: number | string
  ) => {
    setSetsByExercise((prev) => {
      const rows = [...(prev[templateId] ?? [])];
      rows[rowIndex] = { ...rows[rowIndex], [field]: value };
      return { ...prev, [templateId]: rows };
    });
  };

  const saveSet = async (
    templateId: string,
    template: TemplateWithName,
    rowIndex: number,
    draft: SetDraft
  ) => {
    if (
      !workoutId ||
      !workoutPerformedAt ||
      (draft.reps <= 0 && draft.weight <= 0)
    )
      return;
    const order = nextSetOrderRef.current++;
    const id = await createDoc("sets", {
      workoutId,
      exerciseId: template.exerciseId,
      exerciseNameSnapshot: template.exerciseName,
      reps: draft.reps || 0,
      weight: draft.weight || 0,
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
  };

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
          Date & time
          <input
            type="datetime-local"
            value={workoutDate}
            onChange={(e) => setWorkoutDate(e.target.value)}
            className="ml-2 min-h-[44px] rounded-xl border border-gray-300 px-3"
          />
        </label>
        <label className="text-sm text-gray-600">
          Day template
          <input
            type="text"
            placeholder="Search days..."
            value={daySearch}
            onChange={(e) => setDaySearch(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-gray-300 px-4 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
            <p className="font-medium text-gray-900">{template.exerciseName}</p>
            <p className="text-sm text-gray-500">
              Target: {template.repsLower}–{template.repsUpper} reps
              {last && (
                <span className="ml-2">
                  · Last: {last.reps} × {last.weight} lbs
                </span>
              )}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {rows.map((row, idx) => (
                <li key={idx} className="flex flex-wrap items-center gap-2">
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
                        Number(e.target.value) || 0
                      )
                    }
                    className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="Weight"
                    value={row.weight || ""}
                    onChange={(e) =>
                      updateSetRow(
                        template.id,
                        idx,
                        "weight",
                        Number(e.target.value) || 0
                      )
                    }
                    className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <span className="text-sm text-gray-500">lbs</span>
                  <input
                    type="text"
                    placeholder="Note"
                    value={row.note}
                    onChange={(e) =>
                      updateSetRow(template.id, idx, "note", e.target.value)
                    }
                    className="min-w-[80px] flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  {row.savedId ? (
                    <span className="text-xs text-green-600">Saved</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void saveSet(template.id, template, idx, row)
                      }
                      className="rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500"
                    >
                      Save
                    </button>
                  )}
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
    </div>
  );
}

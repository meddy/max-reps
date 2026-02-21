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
import type {
  Workout,
  WorkoutSet,
  Exercise,
  ExerciseSetTemplate,
} from "../../types";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { IconTrash } from "../../components/Icons";
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

const DEBOUNCE_MS = 800;

async function fetchLastSetsForExercise(
  exerciseId: string,
  excludeWorkoutId?: string
): Promise<Array<{ reps: number; weight: number; note?: string }>> {
  const setsRef = getCollectionRef("sets");
  const sq = query(
    setsRef,
    where("exerciseId", "==", exerciseId),
    orderBy("performedAt", "desc"),
    limit(50)
  );
  const sSnap = await getDocs(sq);
  if (sSnap.empty) return [];
  const docs = sSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as (WorkoutSet & { id: string })[];
  const targetWorkoutId = docs.find(
    (d) => !excludeWorkoutId || d.workoutId !== excludeWorkoutId
  )?.workoutId;
  if (!targetWorkoutId) return [];
  const group = docs
    .filter((d) => d.workoutId === targetWorkoutId)
    .sort((a, b) => a.order - b.order);
  return group.map((s) => ({
    reps: s.reps,
    weight: s.weight,
    note: s.note,
  }));
}

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

  const [isTemplateMode, setIsTemplateMode] = useState(false);
  const [templateModeLoading, setTemplateModeLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateWithName[]>([]);
  const [templateSetsByExercise, setTemplateSetsByExercise] = useState<
    Record<string, SetDraft[]>
  >({});
  const [lastPerformed, setLastPerformed] = useState<
    Record<string, Array<{ reps: number; weight: number; note?: string }>>
  >({});
  const [deleteSetConfirm, setDeleteSetConfirm] = useState<{
    setId: string;
    templateId: string;
    rowIndex: number;
  } | null>(null);
  const [removeExerciseConfirmTemplateId, setRemoveExerciseConfirmTemplateId] =
    useState<string | null>(null);
  const nextSetOrderRef = useRef(0);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );
  const persistDebounceTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const templateSetsByExerciseRef = useRef<Record<string, SetDraft[]>>({});

  useEffect(() => {
    setsByExerciseRef.current = setsByExercise;
  }, [setsByExercise]);

  useEffect(() => {
    templateSetsByExerciseRef.current = templateSetsByExercise;
  }, [templateSetsByExercise]);

  useEffect(() => {
    return () => {
      for (const key of Object.keys(debounceTimers.current)) {
        clearTimeout(debounceTimers.current[key]);
      }
      debounceTimers.current = {};
      for (const key of Object.keys(persistDebounceTimers.current)) {
        clearTimeout(persistDebounceTimers.current[key]);
      }
      persistDebounceTimers.current = {};
    };
  }, []);

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

    if (list.length === 0 && workout?.dayId) {
      setTemplateModeLoading(true);
      const templatesRef = getCollectionRef("exerciseSetTemplates");
      const tq = query(
        templatesRef,
        where("dayId", "==", workout.dayId),
        orderBy("order"),
        limit(100)
      );
      const tSnap = await getDocs(tq);
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
          const sets = await fetchLastSetsForExercise(t.exerciseId, id);
          return [t.exerciseId, sets] as const;
        })
      );
      const last: Record<
        string,
        Array<{ reps: number; weight: number; note?: string }>
      > = {};
      for (const [eid, sets] of lastResults) {
        if (sets.length > 0) last[eid] = sets;
      }

      setTemplateSetsByExercise(initialSets);
      setLastPerformed(last);
      setIsTemplateMode(true);
      setTemplateModeLoading(false);
    }
  }, [id, workout?.dayId]);

  useEffect(() => {
    void loadWorkout();
  }, [loadWorkout]);

  useEffect(() => {
    if (workout) void loadSets();
  }, [workout?.id, loadSets]);

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

  const saveNote = async (value: string) => {
    if (!workout) return;
    await updateDocById("workouts", workout.id, { note: value });
    setWorkout((prev) => (prev ? { ...prev, note: value } : null));
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

  const debouncedPersistSet = useCallback(
    (exerciseId: string, rowIndex: number, rowKey: string) => {
      const key = `persist-${exerciseId}-${rowKey}`;
      if (persistDebounceTimers.current[key] != null) {
        clearTimeout(persistDebounceTimers.current[key]);
        delete persistDebounceTimers.current[key];
      }
      persistDebounceTimers.current[key] = setTimeout(() => {
        delete persistDebounceTimers.current[key];
        persistSet(exerciseId, rowIndex);
      }, DEBOUNCE_MS);
    },
    [persistSet]
  );

  const flushPersistDebounceAndSave = useCallback(
    (exerciseId: string, rowIndex: number, rowKey: string) => {
      const key = `persist-${exerciseId}-${rowKey}`;
      if (persistDebounceTimers.current[key] != null) {
        clearTimeout(persistDebounceTimers.current[key]);
        delete persistDebounceTimers.current[key];
      }
      persistSet(exerciseId, rowIndex);
    },
    [persistSet]
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

  const templateAddSetRow = (templateId: string) => {
    setTemplateSetsByExercise((prev) => ({
      ...prev,
      [templateId]: [
        ...(prev[templateId] ?? []),
        { draftId: crypto.randomUUID(), reps: 0, weight: 0, note: "" },
      ],
    }));
  };

  const templateRemoveSetRow = (
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
    setTemplateSetsByExercise((prev) => {
      const rows = [...(prev[templateId] ?? [])];
      rows.splice(rowIndex, 1);
      return { ...prev, [templateId]: rows };
    });
  };

  const handleConfirmDeleteSetTemplate = async () => {
    if (!deleteSetConfirm) return;
    await deleteDocById("sets", deleteSetConfirm.setId);
    setTemplateSetsByExercise((prev) => {
      const rows = [...(prev[deleteSetConfirm.templateId] ?? [])];
      rows.splice(deleteSetConfirm.rowIndex, 1);
      return { ...prev, [deleteSetConfirm.templateId]: rows };
    });
    setDeleteSetConfirm(null);
  };

  const templateRemoveExerciseFromView = (templateId: string) => {
    setRemoveExerciseConfirmTemplateId(templateId);
  };

  const handleConfirmRemoveExerciseTemplate = async () => {
    const templateId = removeExerciseConfirmTemplateId;
    if (!templateId) return;
    const rows = templateSetsByExercise[templateId] ?? [];
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
    setTemplateSetsByExercise((prev) => {
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

  const templateSaveSet = useCallback(
    async (
      templateId: string,
      template: TemplateWithName,
      rowIndex: number,
      draft: SetDraft
    ) => {
      if (!id || !workout) return;
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
          const newId = await createDoc("sets", {
            workoutId: id,
            exerciseId: template.exerciseId,
            exerciseNameSnapshot: template.exerciseName,
            reps: draft.reps,
            weight: draft.weight,
            unit: "lbs",
            note: draft.note ?? "",
            performedAt: workout.date,
            order,
          } as unknown as Omit<WorkoutSet, "id" | "createdAt">);
          setTemplateSetsByExercise((prev) => {
            const rows = [...(prev[templateId] ?? [])];
            rows[rowIndex] = { ...rows[rowIndex], savedId: newId };
            return { ...prev, [templateId]: rows };
          });
        }
      } catch {
        // silently ignore save errors
      }
    },
    [id, workout]
  );

  const templateSaveSetRef = useRef(templateSaveSet);
  useEffect(() => {
    templateSaveSetRef.current = templateSaveSet;
  });

  const templateDebouncedSave = useCallback(
    (templateId: string, draftId: string, template: TemplateWithName) => {
      const key = draftId;
      if (debounceTimers.current[key] != null) {
        clearTimeout(debounceTimers.current[key]);
        delete debounceTimers.current[key];
      }
      debounceTimers.current[key] = setTimeout(() => {
        delete debounceTimers.current[key];
        const latest = templateSetsByExerciseRef.current[templateId] ?? [];
        const idx = latest.findIndex((r) => r.draftId === draftId);
        if (idx === -1) return;
        const latestDraft = latest[idx];
        if (latestDraft.reps <= 0) return;
        void templateSaveSetRef.current(templateId, template, idx, latestDraft);
      }, DEBOUNCE_MS);
    },
    []
  );

  const templateUpdateSetRow = (
    templateId: string,
    rowIndex: number,
    field: keyof SetDraft,
    value: number | string,
    draftId: string,
    template: TemplateWithName
  ) => {
    setTemplateSetsByExercise((prev) => {
      const rows = [...(prev[templateId] ?? [])];
      rows[rowIndex] = { ...rows[rowIndex], [field]: value };
      return { ...prev, [templateId]: rows };
    });
    templateDebouncedSave(templateId, draftId, template);
  };

  const handleAddExerciseTemplate = useCallback(
    async (exerciseId: string, exerciseName: string) => {
      if (!workout) return;
      const syntheticId = `adhoc-${crypto.randomUUID()}`;
      const maxOrder =
        templates.length > 0 ? Math.max(...templates.map((t) => t.order)) : -1;
      const now = Timestamp.now();
      const virtualTemplate: TemplateWithName = {
        id: syntheticId,
        dayId: workout.dayId,
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
      setTemplateSetsByExercise((prev) => ({
        ...prev,
        [syntheticId]: [
          { draftId: crypto.randomUUID(), reps: 0, weight: 0, note: "" },
        ],
      }));
      const sets = await fetchLastSetsForExercise(exerciseId, id);
      if (sets.length > 0) {
        setLastPerformed((prev) => ({
          ...prev,
          [exerciseId]: sets,
        }));
      }
      setAddExerciseOpen(false);
    },
    [workout, templates]
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

        <div className="rounded-xl border-l-4 border-indigo-500 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900">
              {workout.dayNameSnapshot}
            </p>
            <button
              type="button"
              onClick={() => setDeleteWorkoutConfirm(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
              aria-label="Delete workout"
              title="Delete workout"
            >
              <IconTrash className="size-6" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate("/workouts")}
            className="mt-1 text-sm text-gray-500 hover:underline"
          >
            {formatDate(workout.date)}
          </button>
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

        {templates.map((template) => {
          const rows = templateSetsByExercise[template.id] ?? [];
          const last = lastPerformed[template.exerciseId];
          const lastFormatted =
            last && last.length > 0
              ? last.map((s) => `${s.reps}×${s.weight}`).join(", ") + " lbs"
              : null;
          const metadata = !template.isAdHoc ? (
            <p className="text-sm text-gray-500">
              <strong>Target:</strong> {template.repsLower}–{template.repsUpper}{" "}
              reps
              {lastFormatted && (
                <span className="ml-2">
                  <strong>Last:</strong> {lastFormatted}
                </span>
              )}
            </p>
          ) : (
            lastFormatted && (
              <p className="text-sm text-gray-500">Last: {lastFormatted}</p>
            )
          );
          return (
            <ExerciseCard
              key={template.id}
              exerciseName={template.exerciseName}
              metadata={metadata}
              onRemove={() => templateRemoveExerciseFromView(template.id)}
              onAddSet={() => templateAddSetRow(template.id)}
            >
              {rows.map((row, idx) => (
                <SetRow
                  key={row.draftId}
                  reps={row.reps}
                  weight={row.weight}
                  note={row.note}
                  onRepsChange={(val) =>
                    templateUpdateSetRow(
                      template.id,
                      idx,
                      "reps",
                      val,
                      row.draftId,
                      template
                    )
                  }
                  onWeightChange={(val) =>
                    templateUpdateSetRow(
                      template.id,
                      idx,
                      "weight",
                      val,
                      row.draftId,
                      template
                    )
                  }
                  onNoteChange={(val) =>
                    templateUpdateSetRow(
                      template.id,
                      idx,
                      "note",
                      val,
                      row.draftId,
                      template
                    )
                  }
                  onDelete={() => templateRemoveSetRow(template.id, idx, row)}
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
            void handleAddExerciseTemplate(exerciseId, exerciseName)
          }
        />

        <ConfirmDialog
          open={deleteSetConfirm != null}
          title="Delete set"
          message="Remove this set from the workout?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => void handleConfirmDeleteSetTemplate()}
          onCancel={() => setDeleteSetConfirm(null)}
        />

        <ConfirmDialog
          open={removeExerciseConfirmTemplateId != null}
          title="Remove exercise"
          message={(() => {
            const tid = removeExerciseConfirmTemplateId;
            if (!tid) return "";
            const t = templates.find((x) => x.id === tid);
            const rows = templateSetsByExercise[tid] ?? [];
            const savedCount = rows.filter((r) => r.savedId).length;
            const name = t?.exerciseName ?? "this exercise";
            return savedCount > 0
              ? `Remove ${name} from this workout and delete its ${savedCount} saved set(s)?`
              : `Remove ${name} from this workout?`;
          })()}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => void handleConfirmRemoveExerciseTemplate()}
          onCancel={() => setRemoveExerciseConfirmTemplateId(null)}
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
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
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
                onRepsChange={(val) => {
                  updateSetRow(group.exerciseId, idx, { reps: val });
                  debouncedPersistSet(group.exerciseId, idx, row.key);
                }}
                onWeightChange={(val) => {
                  updateSetRow(group.exerciseId, idx, { weight: val });
                  debouncedPersistSet(group.exerciseId, idx, row.key);
                }}
                onNoteChange={(val) => {
                  updateSetRow(group.exerciseId, idx, { note: val });
                  debouncedPersistSet(group.exerciseId, idx, row.key);
                }}
                onBlur={() =>
                  flushPersistDebounceAndSave(group.exerciseId, idx, row.key)
                }
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState } from "../../components/EmptyState";
import { IconPlus } from "../../components/Icons";
import { LoadErrorPanel } from "../../components/LoadErrorPanel";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { SortToggleButton } from "../../components/SortToggleButton";
import { useDataAccess } from "../../contexts/DataAccessContext";
import { createDayExistenceCache } from "../../lib/dataAccess/dayResolutionCache";
import { createExerciseResolutionCacheFromNames } from "../../lib/dataAccess/exerciseResolutionCache";
import { useInlineWorkoutEditor } from "../../lib/workoutEditor/useInlineWorkoutEditor";
import type { Day, Workout, WorkoutSet } from "../../types";
import { WorkoutCardEditor } from "./WorkoutCardEditor";
import { WorkoutCardReadOnly, type DayLinkState } from "./WorkoutCardReadOnly";
import { WorkoutOptionsMenu } from "./WorkoutOptionsMenu";
import {
  buildWorkoutCardModel,
  compareWorkoutsForSort,
  dateFromInputValue,
  toDateInputValue,
} from "./workoutCardModel";

const PAGE_SIZE = 10;
const SORT_STORAGE_KEY = "max-reps-workout-sort";

type WorkoutRow = Workout & { id: string };
type WorkoutCursor = { date: Date; id: string };

function getStoredSortOrder(): "asc" | "desc" {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (stored === "asc" || stored === "desc") return stored;
  } catch {
    /* ignore */
  }
  return "desc";
}

function mergeLocalOverride(
  items: WorkoutRow[],
  override: WorkoutRow | null,
  sort: "asc" | "desc"
): WorkoutRow[] {
  if (!override) return items;
  const without = items.filter((w) => w.id !== override.id);
  return [...without, override].sort((a, b) =>
    compareWorkoutsForSort(a, b, sort)
  );
}

export function WorkoutsPage({ mode }: { mode: "list" | "single" }) {
  const { id: routeWorkoutId } = useParams<{ id: string }>();
  const dataAccess = useDataAccess();
  const navigate = useNavigate();

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [setsByWorkoutId, setSetsByWorkoutId] = useState<
    Record<string, WorkoutSet[]>
  >({});
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cursorRef = useRef<WorkoutCursor | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() =>
    getStoredSortOrder()
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localOverride, setLocalOverride] = useState<WorkoutRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [days, setDays] = useState<Array<Day & { id: string }>>([]);
  const [daysLoaded, setDaysLoaded] = useState(false);
  const templatesCacheRef = useRef<
    Map<
      string,
      Awaited<
        ReturnType<typeof dataAccess.templates.listForDayWithExerciseNames>
      >
    >
  >(new Map());
  const [fillWarning, setFillWarning] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [exerciseLinkState, setExerciseLinkState] = useState<
    Record<string, { exists: boolean; displayName?: string }>
  >({});
  const [dayLinkState, setDayLinkState] = useState<DayLinkState>({});
  const exerciseCacheRef = useRef(
    createExerciseResolutionCacheFromNames((ids) =>
      dataAccess.resolveExerciseNames(ids)
    )
  );
  const dayCacheRef = useRef(
    createDayExistenceCache((ids) => dataAccess.resolveDayExistence(ids))
  );

  const editingSets = editingId ? (setsByWorkoutId[editingId] ?? []) : [];

  const displayedWorkouts = useMemo(
    () => mergeLocalOverride(workouts, localOverride, sortOrder),
    [workouts, localOverride, sortOrder]
  );

  const loadExerciseLinks = useCallback(
    async (setsMap: Record<string, WorkoutSet[]>) => {
      const ids = new Set<string>();
      for (const sets of Object.values(setsMap)) {
        for (const s of sets) ids.add(s.exerciseId);
      }
      const resolved = await exerciseCacheRef.current.resolve([...ids]);
      const next: Record<string, { exists: boolean; displayName?: string }> =
        {};
      for (const [id, value] of resolved) next[id] = value;
      setExerciseLinkState((prev) => ({ ...prev, ...next }));
    },
    []
  );

  const loadDayLinks = useCallback(async (rows: WorkoutRow[]) => {
    const ids = rows.map((w) => w.dayId).filter(Boolean);
    if (ids.length === 0) return;
    const resolved = await dayCacheRef.current.resolve(ids);
    const next: DayLinkState = {};
    for (const [id, value] of resolved) next[id] = value;
    setDayLinkState((prev) => ({ ...prev, ...next }));
  }, []);

  const loadListPage = useCallback(
    async (opts?: { reset?: boolean }) => {
      const reset = opts?.reset ?? false;
      if (reset) {
        setLoading(true);
        cursorRef.current = null;
      }
      setLoadError(null);
      try {
        const { workouts: page, setsByWorkoutId: setsMap } =
          await dataAccess.workouts.listRecentWithSets({
            sort: sortOrder,
            limit: PAGE_SIZE,
            startAfter: reset ? undefined : (cursorRef.current ?? undefined),
          });
        setHasMore(page.length === PAGE_SIZE);
        if (page.length > 0) {
          const last = page[page.length - 1]!;
          cursorRef.current = { date: last.date, id: last.id };
        }
        if (reset) {
          setWorkouts(page);
          setSetsByWorkoutId(setsMap);
          // Drop local override if it appears in the fresh server page.
          setLocalOverride((prev) =>
            prev && page.some((w) => w.id === prev.id) ? null : prev
          );
        } else {
          setWorkouts((prev) => {
            const seen = new Set(prev.map((w) => w.id));
            const merged = [...prev];
            for (const w of page) {
              if (!seen.has(w.id)) merged.push(w);
            }
            // Deduplicate against local override when load-more returns it.
            setLocalOverride((override) =>
              override && page.some((w) => w.id === override.id)
                ? null
                : override
            );
            return merged;
          });
          setSetsByWorkoutId((prev) => ({ ...prev, ...setsMap }));
        }
        await Promise.all([loadExerciseLinks(setsMap), loadDayLinks(page)]);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [dataAccess.workouts, loadDayLinks, loadExerciseLinks, sortOrder]
  );

  const loadSingle = useCallback(async () => {
    if (!routeWorkoutId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await dataAccess.workouts.getWithSets(routeWorkoutId);
      if (!result) {
        setLoadError("Workout not found");
        setWorkouts([]);
        setSetsByWorkoutId({});
        return;
      }
      setWorkouts([result.workout]);
      setSetsByWorkoutId({ [result.workout.id]: result.sets });
      await Promise.all([
        loadExerciseLinks({ [result.workout.id]: result.sets }),
        loadDayLinks([result.workout]),
      ]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [dataAccess.workouts, loadDayLinks, loadExerciseLinks, routeWorkoutId]);

  useEffect(() => {
    if (mode === "list") {
      void loadListPage({ reset: true });
    } else {
      void loadSingle();
    }
    // Intentionally re-run when sortOrder changes via loadListPage identity.
  }, [mode, sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation / unload guard while editing with pending or invalid drafts.
  const guardRef = useRef({ editingId, busy: false });
  guardRef.current.editingId = editingId;
  const editorDiscardRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!guardRef.current.editingId || !guardRef.current.busy) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const ensureDaysLoaded = useCallback(async () => {
    if (daysLoaded) return days;
    const list = await dataAccess.days.list({ sort: "asc", limit: 500 });
    setDays(list);
    setDaysLoaded(true);
    return list;
  }, [dataAccess.days, days, daysLoaded]);

  const getTemplatesForDay = useCallback(
    async (dayId: string) => {
      const cached = templatesCacheRef.current.get(dayId);
      if (cached) return cached;
      const templates =
        await dataAccess.templates.listForDayWithExerciseNames(dayId);
      templatesCacheRef.current.set(dayId, templates);
      return templates;
    },
    [dataAccess.templates]
  );

  async function handleCreate() {
    if (editingId || mutating) return;
    setMutating(true);
    try {
      const date = dateFromInputValue(toDateInputValue());
      const id = await dataAccess.workouts.create({
        date,
        dayId: "",
        dayNameSnapshot: "",
        note: "",
      });
      const created: WorkoutRow = {
        id,
        date,
        dayId: "",
        dayNameSnapshot: "",
        note: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setLocalOverride(created);
      setSetsByWorkoutId((prev) => ({ ...prev, [id]: [] }));
      setEditingId(id);
      await ensureDaysLoaded();
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-workout-id="${id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } finally {
      setMutating(false);
    }
  }

  async function handleCopy(source: WorkoutRow) {
    if (editingId || mutating) return;
    setCopyError(null);
    setMutating(true);
    try {
      const sourceSets = setsByWorkoutId[source.id] ?? [];
      const dayList = await ensureDaysLoaded();
      let dayId = source.dayId;
      let dayNameSnapshot = source.dayNameSnapshot;
      if (dayId) {
        const live = dayList.find((d) => d.id === dayId);
        if (!live) {
          dayId = "";
        } else {
          dayNameSnapshot = live.displayName;
        }
      }

      // Resolve current exercise names where possible.
      const exerciseIds = [...new Set(sourceSets.map((s) => s.exerciseId))];
      const resolved = await exerciseCacheRef.current.resolve(exerciseIds);

      const date = dateFromInputValue(toDateInputValue());
      const copySets = [...sourceSets]
        .sort((a, b) => a.order - b.order)
        .map((s, index) => {
          const live = resolved.get(s.exerciseId);
          return {
            exerciseId: s.exerciseId,
            exerciseNameSnapshot:
              live?.exists && live.displayName
                ? live.displayName
                : s.exerciseNameSnapshot,
            reps: s.reps,
            weight: s.weight,
            unit: s.unit,
            order: index,
          };
        });

      const { workoutId, setIds } = await dataAccess.workouts.copyWithSets({
        workout: { date, dayId, dayNameSnapshot, note: "" },
        sets: copySets,
      });

      const created: WorkoutRow = {
        id: workoutId,
        date,
        dayId,
        dayNameSnapshot,
        note: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const newSets: WorkoutSet[] = copySets.map((s, i) => ({
        id: setIds[i]!,
        workoutId,
        exerciseId: s.exerciseId,
        exerciseNameSnapshot: s.exerciseNameSnapshot,
        reps: s.reps,
        weight: s.weight,
        unit: s.unit ?? "lbs",
        note: "",
        performedAt: date,
        order: s.order,
        createdAt: new Date(),
      }));
      setLocalOverride(created);
      setSetsByWorkoutId((prev) => ({ ...prev, [workoutId]: newSets }));
      setEditingId(workoutId);
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-workout-id="${workoutId}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      setCopyError(
        err instanceof Error ? err.message : "Couldn't copy workout"
      );
    } finally {
      setMutating(false);
    }
  }

  async function deleteWorkout(workout: WorkoutRow) {
    setDeleting(true);
    try {
      // Settle the editor first so Cancel cannot race autosave / dispose-flush
      // (which would orphan Sets after the Workout is deleted).
      if (editingId === workout.id) {
        await editorDiscardRef.current?.();
      }
      await dataAccess.workouts.deleteWithSets(workout.id);
      setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
      setSetsByWorkoutId((prev) => {
        const next = { ...prev };
        delete next[workout.id];
        return next;
      });
      if (localOverride?.id === workout.id) setLocalOverride(null);
      if (editingId === workout.id) setEditingId(null);
      setDeleteTarget(null);
      if (mode === "single") navigate("/workouts");
    } finally {
      setDeleting(false);
    }
  }

  function requestDelete(workout: WorkoutRow) {
    const sets = setsByWorkoutId[workout.id] ?? [];
    if (sets.length === 0) {
      void deleteWorkout(workout);
      return;
    }
    setDeleteTarget(workout);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteWorkout(deleteTarget);
  }

  async function beginEdit(workout: WorkoutRow) {
    if (editingId && editingId !== workout.id) return;
    await ensureDaysLoaded();
    if (workout.dayId) {
      const liveDays = await ensureDaysLoaded();
      const live = liveDays.find((d) => d.id === workout.dayId);
      if (!live) {
        // Deleted Day → No Day when editing begins.
        await dataAccess.workouts.update(workout.id, { dayId: "" });
        setWorkouts((prev) =>
          prev.map((w) => (w.id === workout.id ? { ...w, dayId: "" } : w))
        );
        setLocalOverride((prev) =>
          prev?.id === workout.id ? { ...prev, dayId: "" } : prev
        );
      } else {
        await getTemplatesForDay(workout.dayId);
      }
    }
    setEditingId(workout.id);
    setFillWarning(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <LoadErrorPanel
        title="Couldn't load workouts"
        message={loadError}
        onRetry={() =>
          mode === "list" ? loadListPage({ reset: true }) : loadSingle()
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {mode === "single" ? (
            <Link
              to="/workouts"
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              ← Workouts
            </Link>
          ) : (
            <h1 className="text-xl font-semibold text-slate-900">Workouts</h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === "list" ? (
            <div
              className={
                editingId != null || mutating
                  ? "pointer-events-none opacity-50"
                  : ""
              }
            >
              <SortToggleButton
                value={sortOrder}
                ariaLabel="Sort workouts"
                ascLabel="Oldest first"
                descLabel="Newest first"
                onChange={(next) => {
                  if (editingId || mutating) return;
                  setSortOrder(next);
                  try {
                    localStorage.setItem(SORT_STORAGE_KEY, next);
                  } catch {
                    /* ignore */
                  }
                }}
              />
            </div>
          ) : null}
          {mode === "list" ? (
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={editingId != null || mutating}
              className="flex min-h-[44px] items-center gap-1 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <IconPlus className="h-4 w-4" />
              Create workout
            </button>
          ) : null}
        </div>
      </div>

      {copyError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {copyError}
        </p>
      ) : null}

      {displayedWorkouts.length === 0 ? (
        <EmptyState
          title="No workouts yet"
          description="Create a workout to start logging sets."
        />
      ) : (
        <ul className="space-y-3">
          {displayedWorkouts.map((workout) => {
            if (editingId === workout.id) {
              return (
                <li key={workout.id}>
                  <EditingCard
                    workout={workout}
                    sets={editingSets}
                    days={days}
                    fillWarning={fillWarning}
                    onFillWarning={setFillWarning}
                    getTemplatesForDay={getTemplatesForDay}
                    onBusyChange={(busy) => {
                      guardRef.current.busy = busy;
                    }}
                    onRegisterDiscard={(discard) => {
                      editorDiscardRef.current = discard;
                    }}
                    onSetsChange={(sets) => {
                      setSetsByWorkoutId((prev) => ({
                        ...prev,
                        [workout.id]: sets,
                      }));
                    }}
                    onWorkoutChange={(next) => {
                      setWorkouts((prev) =>
                        prev.map((w) => (w.id === next.id ? next : w))
                      );
                      setLocalOverride((prev) =>
                        prev?.id === next.id ? next : prev
                      );
                    }}
                    onConfirm={async (finalWorkout) => {
                      setEditingId(null);
                      setFillWarning(null);
                      // Re-sort on confirm for date edits relative to loaded items.
                      setLocalOverride(finalWorkout);
                      setWorkouts((prev) => {
                        const without = prev.filter(
                          (w) => w.id !== finalWorkout.id
                        );
                        return mergeLocalOverride(
                          without,
                          finalWorkout,
                          sortOrder
                        );
                      });
                      await loadDayLinks([finalWorkout]);
                    }}
                    onDeleteRequest={() => requestDelete(workout)}
                    persistence={{
                      updateWorkout: (patch) =>
                        dataAccess.workouts.update(workout.id, patch),
                      reconcileExercise: (input) =>
                        dataAccess.sets.reconcileExercise({
                          workoutId: workout.id,
                          ...input,
                          performedAt: input.performedAt ?? workout.date,
                        }),
                      reorderAllSets: (updates) =>
                        dataAccess.sets.reorder(updates),
                    }}
                  />
                </li>
              );
            }

            const model = buildWorkoutCardModel(
              workout,
              setsByWorkoutId[workout.id] ?? []
            );
            return (
              <li key={workout.id}>
                <WorkoutCardReadOnly
                  model={model}
                  exerciseLinkState={exerciseLinkState}
                  dayLinkState={dayLinkState}
                  optionsSlot={
                    <WorkoutOptionsMenu
                      disabled={editingId != null || mutating}
                      onEdit={() => void beginEdit(workout)}
                      onCopy={() => void handleCopy(workout)}
                      onDelete={() => requestDelete(workout)}
                    />
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {mode === "list" && hasMore ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            disabled={loadingMore || editingId != null || mutating}
            onClick={() => {
              setLoadingMore(true);
              void loadListPage();
            }}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete workout?"
        message="This permanently deletes the workout and all of its sets."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        cancelLabel="Cancel"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function EditingCard({
  workout,
  sets,
  days,
  fillWarning,
  onFillWarning,
  getTemplatesForDay,
  onBusyChange,
  onRegisterDiscard,
  onSetsChange,
  onWorkoutChange,
  onConfirm,
  onDeleteRequest,
  persistence,
}: {
  workout: WorkoutRow;
  sets: WorkoutSet[];
  days: Array<Day & { id: string }>;
  fillWarning: string | null;
  onFillWarning: (value: string | null) => void;
  getTemplatesForDay: (
    dayId: string
  ) => Promise<
    Awaited<
      ReturnType<
        ReturnType<
          typeof useDataAccess
        >["templates"]["listForDayWithExerciseNames"]
      >
    >
  >;
  onBusyChange: (busy: boolean) => void;
  onRegisterDiscard: (discard: (() => Promise<void>) | null) => void;
  onSetsChange: (sets: WorkoutSet[]) => void;
  onWorkoutChange: (workout: WorkoutRow) => void;
  onConfirm: (workout: WorkoutRow) => Promise<void>;
  onDeleteRequest: () => void;
  persistence: {
    updateWorkout: (
      patch: Partial<
        Pick<Workout, "date" | "dayId" | "dayNameSnapshot" | "note">
      >
    ) => Promise<void>;
    reconcileExercise: (input: {
      exerciseId: string;
      exerciseNameSnapshot: string;
      desiredSets: Array<{ reps: number; weight: number; note: string }>;
      currentSets: Array<{
        id: string;
        exerciseId: string;
        reps: number;
        weight: number;
        note: string;
        order: number;
      }>;
      exerciseOrder: string[];
      performedAt?: Date;
    }) => Promise<{ createdIds: string[] }>;
    reorderAllSets: (
      updates: Array<{ id: string; order: number }>
    ) => Promise<void>;
  };
}) {
  const dateRef = useRef(workout.date);
  dateRef.current = workout.date;
  const workoutRef = useRef(workout);
  workoutRef.current = workout;
  const dayChangeGenRef = useRef(0);
  const onBusyChangeRef = useRef(onBusyChange);
  onBusyChangeRef.current = onBusyChange;
  const onSetsChangeRef = useRef(onSetsChange);
  onSetsChangeRef.current = onSetsChange;
  const onWorkoutChangeRef = useRef(onWorkoutChange);
  onWorkoutChangeRef.current = onWorkoutChange;
  const onRegisterDiscardRef = useRef(onRegisterDiscard);
  onRegisterDiscardRef.current = onRegisterDiscard;

  const editor = useInlineWorkoutEditor({
    workout,
    sets,
    resetKey: workout.id,
    getPerformedAt: () => dateRef.current,
    persistence: {
      updateWorkout: async (patch) => {
        await persistence.updateWorkout(patch);
        const next = {
          ...workoutRef.current,
          ...patch,
          updatedAt: new Date(),
        };
        workoutRef.current = next;
        if (patch.date) dateRef.current = patch.date;
        onWorkoutChangeRef.current(next);
      },
      reconcileExercise: async (input) => {
        const result = await persistence.reconcileExercise({
          ...input,
          performedAt: dateRef.current,
        });
        return result;
      },
      reorderAllSets: persistence.reorderAllSets,
    },
  });

  useEffect(() => {
    onBusyChangeRef.current(
      editor.hasInvalidDraft ||
        editor.hasPendingDebounce ||
        editor.queueStatus === "pending" ||
        editor.queueStatus === "failed"
    );
  }, [editor.hasInvalidDraft, editor.hasPendingDebounce, editor.queueStatus]);

  useEffect(() => {
    const discard = () => editor.discardPendingWrites();
    onRegisterDiscardRef.current(discard);
    return () => {
      onRegisterDiscardRef.current(null);
    };
  }, [editor.editor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onSetsChangeRef.current(editor.editor.getCurrentSets());
  }, [editor.revision, editor.editor]);

  // Load set-target labels when day is present.
  useEffect(() => {
    let cancelled = false;
    async function loadLabels() {
      if (!editor.workout.dayId) return;
      const templates = await getTemplatesForDay(editor.workout.dayId);
      if (!cancelled) editor.setSetTargetLabels(templates);
    }
    void loadLabels();
    return () => {
      cancelled = true;
    };
  }, [editor.workout.dayId, getTemplatesForDay]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WorkoutCardEditor
      workoutId={editor.workout.id}
      date={editor.workout.date}
      dayId={editor.workout.dayId}
      dayNameSnapshot={editor.workout.dayNameSnapshot}
      note={editor.workout.note ?? ""}
      drafts={editor.drafts}
      days={days}
      queueStatus={editor.queueStatus}
      queueError={editor.queueError}
      hasPendingDebounce={editor.hasPendingDebounce}
      hasInvalidDraft={editor.hasInvalidDraft}
      fillWarning={fillWarning}
      onDateChange={(date) => {
        dateRef.current = date;
        void editor.updateMeta({ date });
      }}
      onNoteChange={(note) => {
        void editor.updateMeta({ note });
      }}
      onTitleChange={(dayNameSnapshot) => {
        void editor.updateMeta({ dayNameSnapshot });
      }}
      onDayChange={(dayId) => {
        const day = dayId ? (days.find((d) => d.id === dayId) ?? null) : null;
        const gen = ++dayChangeGenRef.current;
        void (async () => {
          const templates = day ? await getTemplatesForDay(day.id) : [];
          if (gen !== dayChangeGenRef.current) return;
          editor.applyDaySelection(day, templates);
          const next = {
            ...workoutRef.current,
            dayId: day?.id ?? "",
            dayNameSnapshot: day
              ? day.displayName
              : workoutRef.current.dayNameSnapshot,
          };
          workoutRef.current = next;
          onWorkoutChangeRef.current(next);
        })();
      }}
      onTextChange={editor.setText}
      onFlushDraft={(localId) => {
        void editor.flushDraft(localId);
      }}
      onRemoveExercise={editor.removeExercise}
      onReorder={editor.reorderExercises}
      onAddExercise={editor.addExercise}
      onFillFromDay={() => {
        void (async () => {
          if (!editor.workout.dayId) return;
          const templates = await getTemplatesForDay(editor.workout.dayId);
          const result = editor.fillFromDay(templates);
          if (result.danglingSkipped > 0) {
            onFillWarning(
              `Skipped ${result.danglingSkipped} Set Target(s) with missing exercises.`
            );
          } else {
            onFillWarning(null);
          }
        })();
      }}
      onDeleteWorkout={onDeleteRequest}
      onRetry={editor.retry}
      onConfirm={() => {
        void (async () => {
          try {
            await editor.flushAll();
            // Drop empty ephemeral lines by confirming only saved sets remain
            // in the read model — editor drafts with empty text and no setIds
            // disappear on exit.
            onSetsChange(editor.getCurrentSets());
            await onConfirm(editor.editor.getSnapshot().workout);
          } catch {
            /* validation / queue error — stay in edit mode */
          }
        })();
      }}
    />
  );
}

export function WorkoutHistory() {
  return <WorkoutsPage mode="list" />;
}

export function WorkoutDetail() {
  return <WorkoutsPage mode="single" />;
}

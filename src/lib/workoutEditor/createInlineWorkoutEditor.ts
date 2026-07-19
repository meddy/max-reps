import type {
  Day,
  TemplateWithExerciseName,
  Workout,
  WorkoutSet,
} from "../../types";
import { parseSetEntry, type ParsedSet } from "../setEntry";
import { randomId } from "../randomId";
import { formatSetEntry } from "../setEntry";
import { createWriteQueue, type WriteQueue } from "./writeQueue";

export const INLINE_EDITOR_DEBOUNCE_MS = 800;

export type InlineExerciseDraft = {
  localId: string;
  exerciseId: string;
  exerciseName: string;
  /** Raw textarea text — sole editable source of truth while editing. */
  text: string;
  /** Persisted Set ids currently associated with this exercise (order matters). */
  setIds: string[];
  setTargetLabel?: string;
  parseError: { message: string; start: number; end: number } | null;
  isEmpty: boolean;
};

export type InlineEditorPersistence = {
  updateWorkout(
    patch: Partial<Pick<Workout, "date" | "dayId" | "dayNameSnapshot" | "note">>
  ): Promise<void>;
  reconcileExercise(input: {
    exerciseId: string;
    exerciseNameSnapshot: string;
    desiredSets: ParsedSet[];
    currentSets: Array<{
      id: string;
      exerciseId: string;
      reps: number;
      weight: number;
      note: string;
      order: number;
    }>;
    exerciseOrder: string[];
  }): Promise<{ createdIds: string[] }>;
  reorderAllSets(updates: Array<{ id: string; order: number }>): Promise<void>;
};

export type InlineEditorSnapshot = {
  workout: Workout & { id: string };
  drafts: InlineExerciseDraft[];
  revision: number;
  queueStatus: "idle" | "pending" | "failed";
  queueError: Error | null;
  hasInvalidDraft: boolean;
  hasPendingDebounce: boolean;
  isBusy: boolean;
};

export type InlineEditorConfig = {
  workout: Workout & { id: string };
  sets: WorkoutSet[];
  persistence: InlineEditorPersistence;
  getPerformedAt: () => Date;
  debounceMs?: number;
};

function setsToDrafts(sets: WorkoutSet[]): InlineExerciseDraft[] {
  const sorted = [...sets].sort((a, b) => a.order - b.order);
  const drafts: InlineExerciseDraft[] = [];
  for (const set of sorted) {
    const last = drafts[drafts.length - 1];
    if (last && last.exerciseId === set.exerciseId) {
      last.setIds.push(set.id);
      continue;
    }
    drafts.push({
      localId: randomId(),
      exerciseId: set.exerciseId,
      exerciseName: set.exerciseNameSnapshot,
      text: "",
      setIds: [set.id],
      parseError: null,
      isEmpty: false,
    });
  }
  // Reconstruct canonical text only when opening edit mode from saved Sets.
  const byExercise = new Map<string, WorkoutSet[]>();
  for (const set of sorted) {
    const list = byExercise.get(set.exerciseId) ?? [];
    list.push(set);
    byExercise.set(set.exerciseId, list);
  }
  for (const draft of drafts) {
    const group = byExercise.get(draft.exerciseId) ?? [];
    draft.text = formatSetEntry(
      group.map((s) => ({
        reps: s.reps,
        weight: s.weight,
        note: s.note ?? "",
      }))
    );
    draft.isEmpty = draft.text.trim().length === 0;
  }
  return drafts;
}

function validateDraft(text: string): InlineExerciseDraft["parseError"] {
  const parsed = parseSetEntry(text);
  if (parsed.ok) return null;
  return parsed.error;
}

export function createInlineWorkoutEditor(config: InlineEditorConfig) {
  let workout = { ...config.workout };
  let drafts = setsToDrafts(config.sets);
  let currentSets: WorkoutSet[] = [...config.sets].sort(
    (a, b) => a.order - b.order
  );
  let revision = 0;
  const debounceMs = config.debounceMs ?? INLINE_EDITOR_DEBOUNCE_MS;
  const queue: WriteQueue = createWriteQueue();
  const listeners = new Set<() => void>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let cachedSnapshot: InlineEditorSnapshot = buildSnapshot();

  function buildSnapshot(): InlineEditorSnapshot {
    const q = queue.getSnapshot();
    const hasInvalidDraft = drafts.some((d) => d.parseError != null);
    const hasPendingDebounce = debounceTimers.size > 0;
    return {
      workout: { ...workout },
      drafts: drafts.map((d) => ({ ...d })),
      revision,
      queueStatus: q.status,
      queueError: q.error,
      hasInvalidDraft,
      hasPendingDebounce,
      isBusy:
        q.status === "pending" ||
        q.status === "failed" ||
        hasInvalidDraft ||
        hasPendingDebounce,
    };
  }

  function emit() {
    cachedSnapshot = buildSnapshot();
    for (const l of listeners) l();
  }

  function exerciseOrder(): string[] {
    return drafts.map((d) => d.exerciseId);
  }

  function getSnapshot(): InlineEditorSnapshot {
    return cachedSnapshot;
  }

  function bumpRevision(): number {
    revision += 1;
    return revision;
  }

  function applyParseState(localId: string) {
    const draft = drafts.find((d) => d.localId === localId);
    if (!draft) return;
    draft.isEmpty = draft.text.trim().length === 0;
    draft.parseError = draft.isEmpty ? null : validateDraft(draft.text);
  }

  function buildReconcileCommand(localId: string, rev: number) {
    const draft = drafts.find((d) => d.localId === localId);
    if (!draft) {
      return {
        id: `noop-${rev}`,
        revision: rev,
        label: "noop",
        coalesceKey: localId,
        run: async () => {},
      };
    }
    applyParseState(localId);
    if (draft.parseError) {
      return {
        id: `skip-invalid-${rev}`,
        revision: rev,
        label: "skip-invalid",
        coalesceKey: localId,
        run: async () => {},
      };
    }
    const exerciseId = draft.exerciseId;

    return {
      id: `reconcile-${exerciseId}-${rev}`,
      revision: rev,
      label: "reconcile",
      coalesceKey: localId,
      run: async () => {
        // Ignore stale commands superseded by a newer revision for this draft.
        const latest = drafts.find((d) => d.localId === localId);
        if (!latest || latest.exerciseId !== exerciseId) return;
        if (revision < rev) return;

        // Re-read live draft at execution time so in-flight edits win.
        applyParseState(localId);
        if (latest.parseError) return;
        const parsed = parseSetEntry(latest.text);
        const desiredSets = parsed.ok ? parsed.sets : [];
        const exerciseNameSnapshot = latest.exerciseName;
        const setIds = [...latest.setIds];

        const result = await config.persistence.reconcileExercise({
          exerciseId,
          exerciseNameSnapshot,
          desiredSets,
          currentSets: currentSets.map((s) => ({
            id: s.id,
            exerciseId: s.exerciseId,
            reps: s.reps,
            weight: s.weight,
            note: s.note ?? "",
            order: s.order,
          })),
          exerciseOrder: exerciseOrder(),
        });

        // Rebuild local currentSets from desired + retained others.
        const others = currentSets.filter((s) => s.exerciseId !== exerciseId);
        const reused = setIds.slice(0, desiredSets.length);
        const newIds = result.createdIds;
        const allIds = [...reused, ...newIds];
        const performedAt = config.getPerformedAt();
        const rebuiltForExercise: WorkoutSet[] = desiredSets.map((s, i) => ({
          id: allIds[i]!,
          workoutId: workout.id,
          exerciseId,
          exerciseNameSnapshot,
          reps: s.reps,
          weight: s.weight,
          unit: "lbs",
          note: s.note,
          performedAt,
          order: 0,
          createdAt: new Date(),
        }));

        const orderedExerciseIds = exerciseOrder();
        const byEx = new Map<string, WorkoutSet[]>();
        for (const s of others) {
          const list = byEx.get(s.exerciseId) ?? [];
          list.push(s);
          byEx.set(s.exerciseId, list);
        }
        byEx.set(exerciseId, rebuiltForExercise);

        const next: WorkoutSet[] = [];
        let order = 0;
        for (const eid of orderedExerciseIds) {
          const group = byEx.get(eid) ?? [];
          for (const s of group) {
            next.push({ ...s, order });
            order += 1;
          }
        }
        currentSets = next;
        const d = drafts.find((x) => x.localId === localId);
        if (d) d.setIds = allIds;
        emit();
      },
    };
  }

  function scheduleReconcile(localId: string) {
    const existing = debounceTimers.get(localId);
    if (existing) clearTimeout(existing);
    const rev = bumpRevision();
    const timer = setTimeout(() => {
      debounceTimers.delete(localId);
      const draft = drafts.find((d) => d.localId === localId);
      if (!draft) return;
      applyParseState(localId);
      emit();
      if (draft.parseError) return;
      queue.enqueue(buildReconcileCommand(localId, rev));
      emit();
    }, debounceMs);
    debounceTimers.set(localId, timer);
    emit();
  }

  /** Promote armed debounce timers into the write queue (skips invalid drafts). */
  function enqueuePendingDebounces() {
    for (const [localId, timer] of [...debounceTimers.entries()]) {
      clearTimeout(timer);
      debounceTimers.delete(localId);
      const draft = drafts.find((d) => d.localId === localId);
      if (!draft) continue;
      applyParseState(localId);
      if (draft.parseError) continue;
      const rev = bumpRevision();
      queue.enqueue(buildReconcileCommand(localId, rev));
    }
  }

  /** Drop blank local lines that have no saved Sets. */
  function clearEmptyDrafts() {
    const kept: InlineExerciseDraft[] = [];
    for (const d of drafts) {
      if (d.text.trim().length === 0 && d.setIds.length === 0) {
        const timer = debounceTimers.get(d.localId);
        if (timer) {
          clearTimeout(timer);
          debounceTimers.delete(d.localId);
        }
        continue;
      }
      kept.push(d);
    }
    drafts = kept;
  }

  function applySetTargetLabelsFromTemplates(
    templates: TemplateWithExerciseName[]
  ) {
    const byEx = new Map(templates.map((t) => [t.exerciseId, t]));
    for (const draft of drafts) {
      const t = byEx.get(draft.exerciseId);
      draft.setTargetLabel = t
        ? `${t.numSets} × ${t.repsLower}–${t.repsUpper}`
        : undefined;
    }
  }

  /**
   * Append missing exercises from Day Set Targets as blank drafts.
   * Refreshes set-target labels on overlapping drafts.
   */
  function mergeFillFromTemplates(templates: TemplateWithExerciseName[]): {
    added: number;
    danglingSkipped: number;
  } {
    let added = 0;
    let danglingSkipped = 0;
    const existing = new Set(drafts.map((d) => d.exerciseId));
    const sorted = [...templates].sort((a, b) => a.order - b.order);
    for (const t of sorted) {
      if (!t.exerciseId || !t.exerciseDisplayName) {
        danglingSkipped += 1;
        continue;
      }
      if (existing.has(t.exerciseId)) {
        const draft = drafts.find((d) => d.exerciseId === t.exerciseId);
        if (draft) {
          draft.setTargetLabel = `${t.numSets} × ${t.repsLower}–${t.repsUpper}`;
        }
        continue;
      }
      drafts.push({
        localId: randomId(),
        exerciseId: t.exerciseId,
        exerciseName: t.exerciseDisplayName,
        text: "",
        setIds: [],
        setTargetLabel: `${t.numSets} × ${t.repsLower}–${t.repsUpper}`,
        parseError: null,
        isEmpty: true,
      });
      existing.add(t.exerciseId);
      added += 1;
    }
    return { added, danglingSkipped };
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      const unsubQueue = queue.subscribe(() => emit());
      return () => {
        listeners.delete(listener);
        unsubQueue();
      };
    },
    getSnapshot,
    getCurrentSets(): WorkoutSet[] {
      return currentSets.map((s) => ({ ...s }));
    },
    setText(localId: string, text: string) {
      const draft = drafts.find((d) => d.localId === localId);
      if (!draft) return;
      draft.text = text;
      applyParseState(localId);
      emit();
      scheduleReconcile(localId);
    },
    async flushDraft(localId: string) {
      const timer = debounceTimers.get(localId);
      if (timer) {
        clearTimeout(timer);
        debounceTimers.delete(localId);
      }
      const draft = drafts.find((d) => d.localId === localId);
      if (!draft) return;
      applyParseState(localId);
      emit();
      if (draft.parseError) return;
      const rev = bumpRevision();
      queue.enqueue(buildReconcileCommand(localId, rev));
      emit();
      await queue.drain();
    },
    async flushAll() {
      enqueuePendingDebounces();
      emit();
      if (drafts.some((d) => d.parseError)) {
        throw new Error("Cannot flush invalid drafts");
      }
      await queue.drain();
    },
    async updateMeta(
      patch: Partial<
        Pick<Workout, "date" | "dayId" | "dayNameSnapshot" | "note">
      >
    ) {
      const rev = bumpRevision();
      const nextPatch = { ...patch };
      workout = { ...workout, ...nextPatch };
      queue.enqueue({
        id: `meta-${rev}`,
        revision: rev,
        label: "meta",
        run: async () => {
          await config.persistence.updateWorkout(nextPatch);
          workout = { ...workout, ...nextPatch, updatedAt: new Date() };
          if (nextPatch.date) {
            currentSets = currentSets.map((s) => ({
              ...s,
              performedAt: nextPatch.date!,
            }));
          }
          emit();
        },
      });
      emit();
    },
    addExercise(exerciseId: string, exerciseName: string) {
      if (drafts.some((d) => d.exerciseId === exerciseId)) return;
      drafts = [
        ...drafts,
        {
          localId: randomId(),
          exerciseId,
          exerciseName,
          text: "",
          setIds: [],
          parseError: null,
          isEmpty: true,
        },
      ];
      bumpRevision();
      emit();
    },
    removeExercise(localId: string) {
      const draft = drafts.find((d) => d.localId === localId);
      if (!draft) return;
      const removed = { ...draft };
      drafts = drafts.filter((d) => d.localId !== localId);
      const timer = debounceTimers.get(localId);
      if (timer) {
        clearTimeout(timer);
        debounceTimers.delete(localId);
      }
      const orderAfterRemove = drafts.map((d) => d.exerciseId);
      const rev = bumpRevision();
      queue.enqueue({
        id: `remove-${removed.exerciseId}-${rev}`,
        revision: rev,
        label: "remove-exercise",
        coalesceKey: localId,
        run: async () => {
          await config.persistence.reconcileExercise({
            exerciseId: removed.exerciseId,
            exerciseNameSnapshot: removed.exerciseName,
            desiredSets: [],
            currentSets: currentSets.map((s) => ({
              id: s.id,
              exerciseId: s.exerciseId,
              reps: s.reps,
              weight: s.weight,
              note: s.note ?? "",
              order: s.order,
            })),
            exerciseOrder: orderAfterRemove,
          });
          currentSets = currentSets
            .filter((s) => s.exerciseId !== removed.exerciseId)
            .map((s, i) => ({ ...s, order: i }));
          emit();
        },
      });
      emit();
    },
    reorderExercises(activeLocalId: string, overLocalId: string) {
      const from = drafts.findIndex((d) => d.localId === activeLocalId);
      const to = drafts.findIndex((d) => d.localId === overLocalId);
      if (from < 0 || to < 0 || from === to) return;
      const next = [...drafts];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      drafts = next;
      const rev = bumpRevision();
      queue.enqueue({
        id: `reorder-${rev}`,
        revision: rev,
        label: "reorder",
        run: async () => {
          const updates: Array<{ id: string; order: number }> = [];
          let order = 0;
          for (const d of drafts) {
            for (const setId of d.setIds) {
              updates.push({ id: setId, order });
              order += 1;
            }
          }
          if (updates.length > 0) {
            await config.persistence.reorderAllSets(updates);
          }
          const byId = new Map(currentSets.map((s) => [s.id, s]));
          const rebuilt: WorkoutSet[] = [];
          for (const u of updates) {
            const s = byId.get(u.id);
            if (s) rebuilt.push({ ...s, order: u.order });
          }
          // Include any sets not in drafts (shouldn't happen).
          for (const s of currentSets) {
            if (!rebuilt.some((r) => r.id === s.id)) rebuilt.push(s);
          }
          currentSets = rebuilt.sort((a, b) => a.order - b.order);
          emit();
        },
      });
      emit();
    },
    /**
     * Append missing exercises from Day Set Targets as blank drafts.
     * Returns count of dangling (unresolvable) targets skipped.
     * Does not clear existing blank lines.
     */
    fillFromDay(
      templates: TemplateWithExerciseName[],
      options?: { captureDay?: Day }
    ): { added: number; danglingSkipped: number } {
      if (options?.captureDay) {
        workout = {
          ...workout,
          dayId: options.captureDay.id,
          dayNameSnapshot: options.captureDay.displayName,
        };
      }
      const result = mergeFillFromTemplates(templates);
      bumpRevision();
      emit();
      return result;
    },
    /**
     * Change the Workout's Day: drop blank unlogged lines, sync hints,
     * then merge-fill when a Day is selected.
     */
    applyDaySelection(day: Day | null, templates: TemplateWithExerciseName[]) {
      clearEmptyDrafts();
      applySetTargetLabelsFromTemplates(templates);

      if (day) {
        workout = {
          ...workout,
          dayId: day.id,
          dayNameSnapshot: day.displayName,
        };
        const rev = bumpRevision();
        const dayId = day.id;
        const dayNameSnapshot = day.displayName;
        queue.enqueue({
          id: `day-${rev}`,
          revision: rev,
          label: "day",
          run: async () => {
            await config.persistence.updateWorkout({ dayId, dayNameSnapshot });
            emit();
          },
        });
        mergeFillFromTemplates(templates);
        emit();
      } else {
        workout = { ...workout, dayId: "" };
        const rev = bumpRevision();
        queue.enqueue({
          id: `day-clear-${rev}`,
          revision: rev,
          label: "day",
          run: async () => {
            await config.persistence.updateWorkout({ dayId: "" });
            emit();
          },
        });
        emit();
      }
    },
    setSetTargetLabels(templates: TemplateWithExerciseName[]) {
      applySetTargetLabelsFromTemplates(templates);
      emit();
    },
    retry() {
      queue.retry();
      emit();
    },
    dispose() {
      // Flush pending debounced reconciles into the queue and leave the queue
      // running so unmount (e.g. navigating away mid-autosave) does not drop
      // writes. Invalid drafts are skipped; already-queued meta/reconcile/etc.
      // commands continue.
      enqueuePendingDebounces();
      if (queue.getSnapshot().status === "failed") {
        queue.retry();
      }
      emit();
    },
  };
}

export type InlineWorkoutEditor = ReturnType<typeof createInlineWorkoutEditor>;

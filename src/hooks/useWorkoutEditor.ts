import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Workout } from "../types";
import type {
  EditorRowId,
  EditorSetRow,
  PersistableSetFields,
  WorkoutEditorPersistence,
} from "../lib/workoutEditorPersistence";

export type { EditorRowId, EditorSetRow, WorkoutEditorPersistence };

export interface EditorExerciseGroup {
  groupKey: string;
  exerciseId: string;
  exerciseName: string;
  /** Present for day-template groups (link to day detail). */
  dayId?: string;
  rows: EditorSetRow[];
  templateMeta?: {
    repsLower: number;
    repsUpper: number;
    isAdHoc?: boolean;
  };
  lastPerformed?: {
    sets: Array<{ reps: number; weight: number; note?: string }>;
    workoutId: string;
  };
}

const DEFAULT_DEBOUNCE_MS = 800;

export interface UseWorkoutEditorOptions {
  variant: "workout" | "template";
  workoutId: string;
  /** Null only before the workout document is loaded; persistence no-ops until set. */
  workout: Workout | null;
  initialGroups: EditorExerciseGroup[];
  resetKey: string;
  persistence: WorkoutEditorPersistence;
  debounceMs?: number;
}

function cloneGroups(groups: EditorExerciseGroup[]): EditorExerciseGroup[] {
  return groups.map((g) => ({
    ...g,
    rows: g.rows.map((r) => ({ ...r })),
    lastPerformed: g.lastPerformed
      ? {
          workoutId: g.lastPerformed.workoutId,
          sets: g.lastPerformed.sets.map((s) => ({ ...s })),
        }
      : undefined,
  }));
}

function findRowLocation(
  groups: EditorExerciseGroup[],
  rowId: EditorRowId
): { groupIndex: number; rowIndex: number } | null {
  for (let g = 0; g < groups.length; g++) {
    const r = groups[g].rows.findIndex((row) => row.id === rowId);
    if (r !== -1) return { groupIndex: g, rowIndex: r };
  }
  return null;
}

function workoutNextOrderSeed(groups: EditorExerciseGroup[]): number {
  return groups.reduce((acc, g) => acc + g.rows.length, 0);
}

export interface UseWorkoutEditorResult {
  variant: "workout" | "template";
  groups: EditorExerciseGroup[];
  getRowApi(rowId: EditorRowId): {
    row: EditorSetRow;
    setField(field: "reps" | "weight" | "note", value: number | string): void;
    flush(): Promise<void>;
  };
  addExercise(exerciseId: string, name: string): void;
  /** Template mode: append a synthetic template group (e.g. ad-hoc exercise). */
  appendTemplateGroup(group: EditorExerciseGroup): void;
  removeExercise(groupKey: string): Promise<void>;
  addSet(groupKey: string): void;
  /** Deletes Firestore doc when `persistedSetId` is set; always removes the row locally. */
  removeSet(rowId: EditorRowId): Promise<void>;
  flushAll(): Promise<void>;
  isDirty: boolean;
  isSaving: boolean;
  updateLastPerformed(
    exerciseId: string,
    value: NonNullable<EditorExerciseGroup["lastPerformed"]>
  ): void;
}

export function useWorkoutEditor(
  options: UseWorkoutEditorOptions
): UseWorkoutEditorResult {
  const {
    variant,
    workoutId,
    workout,
    initialGroups,
    resetKey,
    persistence,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;

  const initialGroupsRef = useRef(initialGroups);
  initialGroupsRef.current = initialGroups;

  const [groups, setGroups] = useState<EditorExerciseGroup[]>(() =>
    cloneGroups(initialGroups)
  );
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const workoutRef = useRef(workout);
  workoutRef.current = workout;

  const nextOrderRef = useRef(workoutNextOrderSeed(initialGroups));
  const nextSetOrderRef = useRef(0);

  const persistDebounceTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const templateDebounceTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  const savingCountRef = useRef(0);
  const [isSaving, setIsSaving] = useState(false);
  const bumpSaving = useCallback((delta: number) => {
    savingCountRef.current += delta;
    setIsSaving(savingCountRef.current > 0);
  }, []);

  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const markDirty = useCallback((rowId: string) => {
    setDirtyKeys((prev) => new Set(prev).add(rowId));
  }, []);
  const clearDirty = useCallback((rowId: string) => {
    setDirtyKeys((prev) => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
  }, []);

  useEffect(() => {
    const seed = initialGroupsRef.current;
    setGroups(cloneGroups(seed));
    nextOrderRef.current = workoutNextOrderSeed(seed);
    nextSetOrderRef.current = 0;
    setDirtyKeys(new Set());
    for (const k of Object.keys(persistDebounceTimers.current)) {
      clearTimeout(persistDebounceTimers.current[k]);
      delete persistDebounceTimers.current[k];
    }
    for (const k of Object.keys(templateDebounceTimers.current)) {
      clearTimeout(templateDebounceTimers.current[k]);
      delete templateDebounceTimers.current[k];
    }
  }, [resetKey]);

  useEffect(() => {
    return () => {
      for (const k of Object.keys(persistDebounceTimers.current)) {
        clearTimeout(persistDebounceTimers.current[k]);
      }
      persistDebounceTimers.current = {};
      for (const k of Object.keys(templateDebounceTimers.current)) {
        clearTimeout(templateDebounceTimers.current[k]);
      }
      templateDebounceTimers.current = {};
    };
  }, []);

  const persistWorkoutRow = useCallback(
    async (rowId: EditorRowId) => {
      const g = groupsRef.current;
      const loc = findRowLocation(g, rowId);
      if (!loc) return;
      const group = g[loc.groupIndex];
      const row = group.rows[loc.rowIndex];
      if (!row) return;
      const w = workoutRef.current;
      if (!w) return;

      if (row.persistedSetId) {
        bumpSaving(1);
        try {
          await persistence.updateSet(row.persistedSetId, {
            reps: row.reps,
            weight: row.weight,
            note: row.note,
          });
        } finally {
          bumpSaving(-1);
        }
        clearDirty(rowId);
        return;
      }
      if (row.reps <= 0) return;

      const order = nextOrderRef.current++;
      bumpSaving(1);
      try {
        const newId = await persistence.saveSet({
          workoutId,
          exerciseId: group.exerciseId,
          exerciseNameSnapshot: group.exerciseName,
          row: persistableFields(row),
          order,
          performedAt: w.date,
        });
        setGroups((prev) => {
          const next = cloneGroups(prev);
          const L = findRowLocation(next, rowId);
          if (!L) return prev;
          const r = next[L.groupIndex].rows[L.rowIndex];
          r.persistedSetId = newId;
          r.id = newId;
          return next;
        });
      } finally {
        bumpSaving(-1);
      }
      clearDirty(rowId);
    },
    [bumpSaving, clearDirty, persistence, workoutId]
  );

  const schedulePersistWorkout = useCallback(
    (rowId: EditorRowId) => {
      const key = `persist-${rowId}`;
      if (persistDebounceTimers.current[key] != null) {
        clearTimeout(persistDebounceTimers.current[key]);
        delete persistDebounceTimers.current[key];
      }
      markDirty(rowId);
      persistDebounceTimers.current[key] = setTimeout(() => {
        delete persistDebounceTimers.current[key];
        void persistWorkoutRow(rowId);
      }, debounceMs);
    },
    [debounceMs, markDirty, persistWorkoutRow]
  );

  const flushWorkoutRow = useCallback(
    async (rowId: EditorRowId) => {
      const key = `persist-${rowId}`;
      if (persistDebounceTimers.current[key] != null) {
        clearTimeout(persistDebounceTimers.current[key]);
        delete persistDebounceTimers.current[key];
      }
      await persistWorkoutRow(rowId);
    },
    [persistWorkoutRow]
  );

  const templatePersistRow = useCallback(
    async (
      groupKey: string,
      rowIndex: number,
      rowSnapshot: EditorSetRow,
      exerciseId: string,
      exerciseName: string
    ) => {
      const w = workoutRef.current;
      if (!w) return;
      if (rowSnapshot.reps <= 0) return;
      try {
        if (rowSnapshot.persistedSetId) {
          bumpSaving(1);
          try {
            await persistence.updateSet(rowSnapshot.persistedSetId, {
              reps: rowSnapshot.reps,
              weight: rowSnapshot.weight,
              note: rowSnapshot.note ?? "",
            });
          } finally {
            bumpSaving(-1);
          }
        } else {
          const order = nextSetOrderRef.current++;
          bumpSaving(1);
          try {
            const newId = await persistence.saveSet({
              workoutId,
              exerciseId,
              exerciseNameSnapshot: exerciseName,
              row: persistableFields(rowSnapshot),
              order,
              performedAt: w.date,
            });
            setGroups((prev) => {
              const next = cloneGroups(prev);
              const gi = next.findIndex((x) => x.groupKey === groupKey);
              if (gi === -1) return prev;
              const rows = [...next[gi].rows];
              if (!rows[rowIndex] || rows[rowIndex].id !== rowSnapshot.id)
                return prev;
              rows[rowIndex] = {
                ...rows[rowIndex],
                persistedSetId: newId,
              };
              next[gi] = { ...next[gi], rows };
              return next;
            });
          } finally {
            bumpSaving(-1);
          }
        }
      } catch {
        // match WorkoutDetail: ignore template save errors
      }
      clearDirty(rowSnapshot.id);
    },
    [bumpSaving, clearDirty, persistence, workoutId]
  );

  const templateSaveSetRef = useRef(templatePersistRow);
  useEffect(() => {
    templateSaveSetRef.current = templatePersistRow;
  }, [templatePersistRow]);

  const scheduleTemplatePersist = useCallback(
    (groupKey: string, rowId: EditorRowId) => {
      if (templateDebounceTimers.current[rowId] != null) {
        clearTimeout(templateDebounceTimers.current[rowId]);
        delete templateDebounceTimers.current[rowId];
      }
      markDirty(rowId);
      templateDebounceTimers.current[rowId] = setTimeout(() => {
        delete templateDebounceTimers.current[rowId];
        const latest = groupsRef.current;
        const gi = latest.findIndex((x) => x.groupKey === groupKey);
        if (gi === -1) return;
        const rows = latest[gi].rows;
        const idx = rows.findIndex((r) => r.id === rowId);
        if (idx === -1) return;
        const draft = rows[idx];
        if (draft.reps <= 0) return;
        const g = latest[gi];
        void templateSaveSetRef.current(
          groupKey,
          idx,
          draft,
          g.exerciseId,
          g.exerciseName
        );
      }, debounceMs);
    },
    [debounceMs, markDirty]
  );

  const flushTemplateRow = useCallback(
    async (groupKey: string, rowId: EditorRowId) => {
      if (templateDebounceTimers.current[rowId] != null) {
        clearTimeout(templateDebounceTimers.current[rowId]);
        delete templateDebounceTimers.current[rowId];
      }
      const latest = groupsRef.current;
      const gi = latest.findIndex((x) => x.groupKey === groupKey);
      if (gi === -1) return;
      const rows = latest[gi].rows;
      const idx = rows.findIndex((r) => r.id === rowId);
      if (idx === -1) return;
      const draft = rows[idx];
      const g = latest[gi];
      await templatePersistRow(
        groupKey,
        idx,
        draft,
        g.exerciseId,
        g.exerciseName
      );
    },
    [templatePersistRow]
  );

  const getRowApi = useCallback(
    (rowId: EditorRowId) => {
      const loc = findRowLocation(groupsRef.current, rowId);
      const row = loc
        ? groupsRef.current[loc.groupIndex].rows[loc.rowIndex]
        : undefined;
      if (!row || !loc) {
        const fallback: EditorSetRow = {
          id: rowId,
          reps: 0,
          weight: 0,
          note: "",
        };
        return {
          row: fallback,
          setField: () => {},
          flush: async () => {},
        };
      }
      const groupKey = groupsRef.current[loc.groupIndex].groupKey;

      const setField = (
        field: "reps" | "weight" | "note",
        value: number | string
      ) => {
        setGroups((prev) => {
          const next = cloneGroups(prev);
          const L = findRowLocation(next, rowId);
          if (!L) return prev;
          const r = next[L.groupIndex].rows[L.rowIndex];
          if (field === "reps") r.reps = value as number;
          else if (field === "weight") r.weight = value as number;
          else r.note = value as string;
          return next;
        });
        if (variant === "workout") {
          schedulePersistWorkout(rowId);
        } else {
          scheduleTemplatePersist(groupKey, rowId);
        }
      };

      const flush = async () => {
        if (variant === "workout") {
          await flushWorkoutRow(rowId);
        } else {
          await flushTemplateRow(groupKey, rowId);
        }
      };

      return { row, setField, flush };
    },
    [
      flushTemplateRow,
      flushWorkoutRow,
      schedulePersistWorkout,
      scheduleTemplatePersist,
      variant,
    ]
  );

  const addExercise = useCallback((exerciseId: string, name: string) => {
    setGroups((prev) => {
      if (prev.some((g) => g.exerciseId === exerciseId)) return prev;
      const rowId = crypto.randomUUID();
      return [
        ...prev,
        {
          groupKey: exerciseId,
          exerciseId,
          exerciseName: name,
          rows: [
            {
              id: rowId,
              reps: 0,
              weight: 0,
              note: "",
            },
          ],
        },
      ];
    });
  }, []);

  const appendTemplateGroup = useCallback((group: EditorExerciseGroup) => {
    setGroups((prev) => [...prev, cloneGroups([group])[0]]);
  }, []);

  const removeExercise = useCallback(
    async (groupKey: string) => {
      const g = groupsRef.current.find((x) => x.groupKey === groupKey);
      if (!g) return;
      for (const row of g.rows) {
        if (templateDebounceTimers.current[row.id] != null) {
          clearTimeout(templateDebounceTimers.current[row.id]);
          delete templateDebounceTimers.current[row.id];
        }
        if (persistDebounceTimers.current[`persist-${row.id}`] != null) {
          clearTimeout(persistDebounceTimers.current[`persist-${row.id}`]);
          delete persistDebounceTimers.current[`persist-${row.id}`];
        }
      }
      const persistedIds = g.rows
        .map((r) => r.persistedSetId)
        .filter((id): id is string => id != null);
      bumpSaving(persistedIds.length);
      try {
        await Promise.all(persistedIds.map((id) => persistence.deleteSet(id)));
      } finally {
        bumpSaving(-persistedIds.length);
      }
      setGroups((prev) => prev.filter((x) => x.groupKey !== groupKey));
    },
    [bumpSaving, persistence]
  );

  const addSet = useCallback((groupKey: string) => {
    setGroups((prev) => {
      const next = cloneGroups(prev);
      const gi = next.findIndex((g) => g.groupKey === groupKey);
      if (gi === -1) return prev;
      next[gi] = {
        ...next[gi],
        rows: [
          ...next[gi].rows,
          {
            id: crypto.randomUUID(),
            reps: 0,
            weight: 0,
            note: "",
          },
        ],
      };
      return next;
    });
  }, []);

  const removeSet = useCallback(
    async (rowId: EditorRowId) => {
      const loc = findRowLocation(groupsRef.current, rowId);
      if (!loc) return;
      const row = groupsRef.current[loc.groupIndex].rows[loc.rowIndex];
      const groupKey = groupsRef.current[loc.groupIndex].groupKey;
      if (templateDebounceTimers.current[rowId] != null) {
        clearTimeout(templateDebounceTimers.current[rowId]);
        delete templateDebounceTimers.current[rowId];
      }
      if (persistDebounceTimers.current[`persist-${rowId}`] != null) {
        clearTimeout(persistDebounceTimers.current[`persist-${rowId}`]);
        delete persistDebounceTimers.current[`persist-${rowId}`];
      }
      if (row.persistedSetId) {
        bumpSaving(1);
        try {
          await persistence.deleteSet(row.persistedSetId);
        } finally {
          bumpSaving(-1);
        }
      }
      setGroups((prev) => {
        const next = cloneGroups(prev);
        const gi = next.findIndex((g) => g.groupKey === groupKey);
        if (gi === -1) return prev;
        const rows = next[gi].rows.filter((r) => r.id !== rowId);
        next[gi] = { ...next[gi], rows };
        return next;
      });
      clearDirty(rowId);
    },
    [bumpSaving, clearDirty, persistence]
  );

  const flushAll = useCallback(async () => {
    const wKeys = Object.keys(persistDebounceTimers.current)
      .filter((k) => k.startsWith("persist-"))
      .map((k) => k.slice("persist-".length));
    const tKeys = Object.keys(templateDebounceTimers.current);
    const rowIds = [...new Set([...wKeys, ...tKeys])];
    await Promise.all(
      rowIds.map(async (rowId) => {
        const api = getRowApi(rowId);
        await api.flush();
      })
    );
  }, [getRowApi]);

  const updateLastPerformed = useCallback(
    (
      exerciseId: string,
      value: NonNullable<EditorExerciseGroup["lastPerformed"]>
    ) => {
      setGroups((prev) => {
        const next = cloneGroups(prev);
        for (const g of next) {
          if (g.exerciseId === exerciseId) {
            g.lastPerformed = { ...value };
          }
        }
        return next;
      });
    },
    []
  );

  const isDirty = dirtyKeys.size > 0;

  return useMemo(
    () => ({
      variant,
      groups,
      getRowApi,
      addExercise,
      appendTemplateGroup,
      removeExercise,
      addSet,
      removeSet,
      flushAll,
      isDirty,
      isSaving,
      updateLastPerformed,
    }),
    [
      variant,
      groups,
      getRowApi,
      addExercise,
      appendTemplateGroup,
      removeExercise,
      addSet,
      removeSet,
      flushAll,
      isDirty,
      isSaving,
      updateLastPerformed,
    ]
  );
}

function persistableFields(row: EditorSetRow): PersistableSetFields {
  return {
    reps: row.reps,
    weight: row.weight,
    note: row.note,
  };
}

/** Build editor groups from persisted workout sets (workout mode). */
export function editorGroupsFromWorkoutSets(
  sets: Array<import("../types").WorkoutSet & { id: string }>
): EditorExerciseGroup[] {
  const groups: EditorExerciseGroup[] = [];
  const seen = new Set<string>();
  const byExercise: Record<string, EditorSetRow[]> = {};

  for (const s of sets) {
    if (!seen.has(s.exerciseId)) {
      seen.add(s.exerciseId);
      groups.push({
        groupKey: s.exerciseId,
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseNameSnapshot,
        rows: [],
      });
    }
    if (!byExercise[s.exerciseId]) byExercise[s.exerciseId] = [];
    byExercise[s.exerciseId].push({
      id: s.id,
      persistedSetId: s.id,
      reps: s.reps,
      weight: s.weight,
      note: s.note ?? "",
    });
  }
  for (const g of groups) {
    g.rows = byExercise[g.exerciseId] ?? [];
  }
  return groups;
}

export type TemplateWithName = import("../types").ExerciseSetTemplate & {
  id: string;
  exerciseName: string;
  exerciseDisplayName?: string;
  isAdHoc?: boolean;
};

/** Build editor groups for template mode from day templates + last-performed map. */
export function editorGroupsFromDayTemplates(
  templates: TemplateWithName[],
  lastPerformed: Record<
    string,
    {
      sets: Array<{ reps: number; weight: number; note?: string }>;
      workoutId: string;
    }
  >
): EditorExerciseGroup[] {
  return templates.map((t) => ({
    groupKey: t.id,
    exerciseId: t.exerciseId,
    exerciseName: t.exerciseName,
    dayId: t.dayId,
    rows: Array.from({ length: t.numSets }, () => ({
      id: crypto.randomUUID(),
      reps: 0,
      weight: 0,
      note: "",
    })),
    templateMeta: t.isAdHoc
      ? { repsLower: 0, repsUpper: 0, isAdHoc: true }
      : { repsLower: t.repsLower, repsUpper: t.repsUpper, isAdHoc: false },
    lastPerformed: lastPerformed[t.exerciseId],
  }));
}

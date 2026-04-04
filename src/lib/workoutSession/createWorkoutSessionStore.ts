import type { Workout } from "../../types";
import type { EditorRowId, EditorSetRow } from "../workoutEditorPersistence";
import {
  cloneGroups,
  findRowLocation,
  persistableFields,
  type EditorExerciseGroup,
  type WorkoutEditorPersistence,
  type WorkoutSessionSnapshot,
  workoutNextOrderSeed,
} from "./model";

export type WorkoutSessionStoreConfig = {
  variant: "workout" | "template";
  workoutId: string;
  persistence: WorkoutEditorPersistence;
  debounceMs: number;
  getWorkout: () => Workout | null;
};

export type WorkoutRowApi = {
  row: EditorSetRow;
  setField(field: "reps" | "weight" | "note", value: number | string): void;
  flush(): Promise<void>;
};

export type WorkoutSessionStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => WorkoutSessionSnapshot;
  dispose: () => void;
  applyReset: (initialGroups: EditorExerciseGroup[]) => void;
  getRowApi: (rowId: EditorRowId) => WorkoutRowApi;
  addExercise: (exerciseId: string, name: string) => void;
  appendTemplateGroup: (group: EditorExerciseGroup) => void;
  removeExercise: (groupKey: string) => Promise<void>;
  addSet: (groupKey: string) => void;
  removeSet: (rowId: EditorRowId) => Promise<void>;
  flushAll: () => Promise<void>;
  updateLastPerformed: (
    exerciseId: string,
    value: NonNullable<EditorExerciseGroup["lastPerformed"]>
  ) => void;
};

function makeSnapshot(
  groups: EditorExerciseGroup[],
  dirtyKeys: Set<string>,
  variant: "workout" | "template"
): WorkoutSessionSnapshot {
  return {
    groups: cloneGroups(groups),
    isDirty: dirtyKeys.size > 0,
    variant,
  };
}

export function createWorkoutSessionStore(
  config: WorkoutSessionStoreConfig
): WorkoutSessionStore {
  const { variant, workoutId, persistence, debounceMs } = config;
  const getWorkout = config.getWorkout;

  let groups: EditorExerciseGroup[] = [];
  let dirtyKeys = new Set<string>();
  let snapshot = makeSnapshot(groups, dirtyKeys, variant);
  const listeners = new Set<() => void>();

  let nextOrder = 0;
  let nextSetOrder = 0;

  const persistDebounceTimers: Record<
    string,
    ReturnType<typeof setTimeout>
  > = {};
  const templateDebounceTimers: Record<
    string,
    ReturnType<typeof setTimeout>
  > = {};

  function emit() {
    snapshot = makeSnapshot(groups, dirtyKeys, variant);
    for (const l of listeners) l();
  }

  function clearPersistTimers() {
    for (const k of Object.keys(persistDebounceTimers)) {
      clearTimeout(persistDebounceTimers[k]);
      delete persistDebounceTimers[k];
    }
  }

  function clearTemplateTimers() {
    for (const k of Object.keys(templateDebounceTimers)) {
      clearTimeout(templateDebounceTimers[k]);
      delete templateDebounceTimers[k];
    }
  }

  function markDirty(rowId: string) {
    dirtyKeys.add(rowId);
    emit();
  }

  function clearDirty(rowId: string) {
    dirtyKeys.delete(rowId);
    emit();
  }

  function setGroupsFromUpdater(
    updater: (prev: EditorExerciseGroup[]) => EditorExerciseGroup[]
  ) {
    groups = updater(cloneGroups(groups));
    emit();
  }

  async function persistWorkoutRow(rowId: EditorRowId) {
    const g = groups;
    const loc = findRowLocation(g, rowId);
    if (!loc) return;
    const group = g[loc.groupIndex];
    const row = group.rows[loc.rowIndex];
    if (!row) return;
    const w = getWorkout();
    if (!w) return;

    if (row.persistedSetId) {
      await persistence.updateSet(row.persistedSetId, {
        reps: row.reps,
        weight: row.weight,
        note: row.note,
      });
      clearDirty(rowId);
      return;
    }
    if (row.reps <= 0) return;

    const order = nextOrder++;
    const newId = await persistence.saveSet({
      workoutId,
      exerciseId: group.exerciseId,
      exerciseNameSnapshot: group.exerciseName,
      row: persistableFields(row),
      order,
      performedAt: w.date,
    });
    setGroupsFromUpdater((prev) => {
      const next = cloneGroups(prev);
      const L = findRowLocation(next, rowId);
      if (!L) return prev;
      const r = next[L.groupIndex].rows[L.rowIndex];
      r.persistedSetId = newId;
      r.id = newId;
      return next;
    });
    clearDirty(rowId);
  }

  function schedulePersistWorkout(rowId: EditorRowId) {
    const key = `persist-${rowId}`;
    if (persistDebounceTimers[key] != null) {
      clearTimeout(persistDebounceTimers[key]);
      delete persistDebounceTimers[key];
    }
    markDirty(rowId);
    persistDebounceTimers[key] = setTimeout(() => {
      delete persistDebounceTimers[key];
      void persistWorkoutRow(rowId);
    }, debounceMs);
  }

  async function flushWorkoutRow(rowId: EditorRowId) {
    const key = `persist-${rowId}`;
    if (persistDebounceTimers[key] != null) {
      clearTimeout(persistDebounceTimers[key]);
      delete persistDebounceTimers[key];
    }
    await persistWorkoutRow(rowId);
  }

  async function templatePersistRow(
    groupKey: string,
    rowIndex: number,
    rowSnapshot: EditorSetRow,
    exerciseId: string,
    exerciseName: string
  ) {
    const w = getWorkout();
    if (!w) return;
    if (rowSnapshot.reps <= 0) return;
    try {
      if (rowSnapshot.persistedSetId) {
        await persistence.updateSet(rowSnapshot.persistedSetId, {
          reps: rowSnapshot.reps,
          weight: rowSnapshot.weight,
          note: rowSnapshot.note ?? "",
        });
      } else {
        const order = nextSetOrder++;
        const newId = await persistence.saveSet({
          workoutId,
          exerciseId,
          exerciseNameSnapshot: exerciseName,
          row: persistableFields(rowSnapshot),
          order,
          performedAt: w.date,
        });
        setGroupsFromUpdater((prev) => {
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
      }
    } catch {
      // match WorkoutDetail: ignore template save errors
    }
    clearDirty(rowSnapshot.id);
  }

  function scheduleTemplatePersist(groupKey: string, rowId: EditorRowId) {
    if (templateDebounceTimers[rowId] != null) {
      clearTimeout(templateDebounceTimers[rowId]);
      delete templateDebounceTimers[rowId];
    }
    markDirty(rowId);
    templateDebounceTimers[rowId] = setTimeout(() => {
      delete templateDebounceTimers[rowId];
      const latest = groups;
      const gi = latest.findIndex((x) => x.groupKey === groupKey);
      if (gi === -1) return;
      const rows = latest[gi].rows;
      const idx = rows.findIndex((r) => r.id === rowId);
      if (idx === -1) return;
      const draft = rows[idx];
      if (draft.reps <= 0) return;
      const g = latest[gi];
      void templatePersistRow(
        groupKey,
        idx,
        draft,
        g.exerciseId,
        g.exerciseName
      );
    }, debounceMs);
  }

  async function flushTemplateRow(groupKey: string, rowId: EditorRowId) {
    if (templateDebounceTimers[rowId] != null) {
      clearTimeout(templateDebounceTimers[rowId]);
      delete templateDebounceTimers[rowId];
    }
    const latest = groups;
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
  }

  function getRowApi(rowId: EditorRowId): WorkoutRowApi {
    const loc = findRowLocation(groups, rowId);
    const row = loc ? groups[loc.groupIndex].rows[loc.rowIndex] : undefined;
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
    const groupKey = groups[loc.groupIndex].groupKey;

    const setField = (
      field: "reps" | "weight" | "note",
      value: number | string
    ) => {
      setGroupsFromUpdater((prev) => {
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
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    dispose() {
      clearPersistTimers();
      clearTemplateTimers();
      listeners.clear();
    },
    applyReset(initialGroups) {
      groups = cloneGroups(initialGroups);
      nextOrder = workoutNextOrderSeed(initialGroups);
      nextSetOrder = 0;
      dirtyKeys = new Set();
      clearPersistTimers();
      clearTemplateTimers();
      emit();
    },
    getRowApi,
    addExercise(exerciseId, name) {
      setGroupsFromUpdater((prev) => {
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
    },
    appendTemplateGroup(group) {
      setGroupsFromUpdater((prev) => [...prev, cloneGroups([group])[0]]);
    },
    async removeExercise(groupKey) {
      const g = groups.find((x) => x.groupKey === groupKey);
      if (!g) return;
      for (const row of g.rows) {
        if (templateDebounceTimers[row.id] != null) {
          clearTimeout(templateDebounceTimers[row.id]);
          delete templateDebounceTimers[row.id];
        }
        const pk = `persist-${row.id}`;
        if (persistDebounceTimers[pk] != null) {
          clearTimeout(persistDebounceTimers[pk]);
          delete persistDebounceTimers[pk];
        }
      }
      const persistedIds = g.rows
        .map((r) => r.persistedSetId)
        .filter((id): id is string => id != null);
      await Promise.all(persistedIds.map((id) => persistence.deleteSet(id)));
      setGroupsFromUpdater((prev) =>
        prev.filter((x) => x.groupKey !== groupKey)
      );
    },
    addSet(groupKey) {
      setGroupsFromUpdater((prev) => {
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
    },
    async removeSet(rowId) {
      const loc = findRowLocation(groups, rowId);
      if (!loc) return;
      const row = groups[loc.groupIndex].rows[loc.rowIndex];
      const groupKey = groups[loc.groupIndex].groupKey;
      if (templateDebounceTimers[rowId] != null) {
        clearTimeout(templateDebounceTimers[rowId]);
        delete templateDebounceTimers[rowId];
      }
      const pk = `persist-${rowId}`;
      if (persistDebounceTimers[pk] != null) {
        clearTimeout(persistDebounceTimers[pk]);
        delete persistDebounceTimers[pk];
      }
      if (row.persistedSetId) {
        await persistence.deleteSet(row.persistedSetId);
      }
      setGroupsFromUpdater((prev) => {
        const next = cloneGroups(prev);
        const gi = next.findIndex((g) => g.groupKey === groupKey);
        if (gi === -1) return prev;
        const rows = next[gi].rows.filter((r) => r.id !== rowId);
        next[gi] = { ...next[gi], rows };
        return next;
      });
      clearDirty(rowId);
    },
    async flushAll() {
      const wKeys = Object.keys(persistDebounceTimers)
        .filter((k) => k.startsWith("persist-"))
        .map((k) => k.slice("persist-".length));
      const tKeys = Object.keys(templateDebounceTimers);
      const rowIds = [...new Set([...wKeys, ...tKeys])];
      await Promise.all(
        rowIds.map(async (rid) => {
          await getRowApi(rid).flush();
        })
      );
    },
    updateLastPerformed(exerciseId, value) {
      setGroupsFromUpdater((prev) => {
        const next = cloneGroups(prev);
        for (const g of next) {
          if (g.exerciseId === exerciseId) {
            g.lastPerformed = { ...value };
          }
        }
        return next;
      });
    },
  };
}

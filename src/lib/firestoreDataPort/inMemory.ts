import type { CollectionName } from "../../types";
import type { FirestoreDataPort, RawDoc } from "./types";

type Store = Map<CollectionName, Map<string, Record<string, unknown>>>;

function newId(): string {
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function cmpStr(a: string, b: string): number {
  return a.localeCompare(b);
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  if (v && typeof v === "object" && "toDate" in v) {
    const d = (v as { toDate: () => Date }).toDate();
    return d.getTime();
  }
  return 0;
}

export function createInMemoryFirestoreDataPort(
  initial?: Partial<
    Record<CollectionName, Record<string, Record<string, unknown>>>
  >
): FirestoreDataPort {
  const store: Store = new Map();

  function ensureCol(
    name: CollectionName
  ): Map<string, Record<string, unknown>> {
    let m = store.get(name);
    if (!m) {
      m = new Map();
      store.set(name, m);
    }
    return m;
  }

  if (initial) {
    for (const [col, docs] of Object.entries(initial)) {
      const m = ensureCol(col as CollectionName);
      for (const [id, data] of Object.entries(docs)) {
        m.set(id, { ...data });
      }
    }
  }

  function listCol(name: CollectionName): RawDoc[] {
    const m = store.get(name);
    if (!m) return [];
    return [...m.entries()].map(([id, data]) => ({ id, data: { ...data } }));
  }

  const port: FirestoreDataPort = {
    async getDocument(collectionName, id) {
      const m = store.get(collectionName);
      const data = m?.get(id);
      if (!data) return null;
      return { id, data: { ...data } };
    },

    async addDocument(collectionName, data) {
      const id = newId();
      ensureCol(collectionName).set(id, { ...data });
      return id;
    },

    async patchDocument(collectionName, id, data) {
      const m = ensureCol(collectionName);
      const cur = m.get(id) ?? {};
      m.set(id, { ...cur, ...data });
    },

    async removeDocument(collectionName, id) {
      store.get(collectionName)?.delete(id);
    },

    async removeDocumentAndRelated(collectionName, id, cascades) {
      for (const { collection: childName, field } of cascades) {
        const col = store.get(childName);
        if (!col) continue;
        const toDelete: string[] = [];
        for (const [docId, data] of col.entries()) {
          if (data[field] === id) toDelete.push(docId);
        }
        for (const docId of toDelete) col.delete(docId);
      }
      store.get(collectionName)?.delete(id);
    },

    async syncWorkoutDateAndSetsPerformedAt(workoutId, date) {
      const workouts = ensureCol("workouts");
      const cur = workouts.get(workoutId);
      if (cur) {
        workouts.set(workoutId, { ...cur, date });
      }
      const setsCol = store.get("sets");
      if (!setsCol) return;
      for (const [setId, data] of setsCol.entries()) {
        if (data.workoutId === workoutId) {
          setsCol.set(setId, { ...data, performedAt: date });
        }
      }
    },

    async queryExercisesByNamePrefix(term, max) {
      const hi = term + "\uf8ff";
      return listCol("exercises")
        .filter(
          (d) =>
            typeof d.data.nameLower === "string" &&
            d.data.nameLower >= term &&
            d.data.nameLower <= hi
        )
        .sort((a, b) =>
          cmpStr(a.data.nameLower as string, b.data.nameLower as string)
        )
        .slice(0, max);
    },

    async queryExerciseByNameLowerEqual(nameLower) {
      const hit = listCol("exercises").find(
        (d) => d.data.nameLower === nameLower
      );
      return hit ?? null;
    },

    async queryExercisesList(opts) {
      let rows = listCol("exercises");
      const search = opts.search?.trim().toLowerCase();
      if (search) {
        const hi = search + "\uf8ff";
        rows = rows.filter(
          (d) =>
            typeof d.data.nameLower === "string" &&
            d.data.nameLower >= search &&
            d.data.nameLower <= hi
        );
      }
      rows.sort((a, b) => {
        const an = a.data.nameLower as string;
        const bn = b.data.nameLower as string;
        return opts.sort === "asc" ? cmpStr(an, bn) : cmpStr(bn, an);
      });
      return rows.slice(0, opts.limit);
    },

    async queryDaysByNamePrefix(term, max) {
      const hi = term + "\uf8ff";
      return listCol("days")
        .filter(
          (d) =>
            typeof d.data.nameLower === "string" &&
            d.data.nameLower >= term &&
            d.data.nameLower <= hi
        )
        .sort((a, b) =>
          cmpStr(a.data.nameLower as string, b.data.nameLower as string)
        )
        .slice(0, max);
    },

    async queryDayByNameLowerEqual(nameLower) {
      const hit = listCol("days").find((d) => d.data.nameLower === nameLower);
      return hit ?? null;
    },

    async queryDaysList(opts) {
      const rows = listCol("days").sort((a, b) => {
        const an = a.data.nameLower as string;
        const bn = b.data.nameLower as string;
        return opts.sort === "asc" ? cmpStr(an, bn) : cmpStr(bn, an);
      });
      return rows.slice(0, opts.limit);
    },

    async querySetsForWorkoutOrdered(workoutId) {
      return listCol("sets")
        .filter((d) => d.data.workoutId === workoutId)
        .sort((a, b) => (a.data.order as number) - (b.data.order as number))
        .slice(0, 500);
    },

    async queryWorkoutsByDate(opts) {
      const rows = listCol("workouts").sort((a, b) => {
        const ta = asNumber(a.data.date);
        const tb = asNumber(b.data.date);
        return opts.sort === "asc" ? ta - tb : tb - ta;
      });
      return rows.slice(0, opts.limit);
    },

    async querySetsByWorkoutId(workoutId) {
      return listCol("sets").filter((d) => d.data.workoutId === workoutId);
    },

    async querySetsByExercisePerformedAtDesc(exerciseId, lim) {
      return listCol("sets")
        .filter((d) => d.data.exerciseId === exerciseId)
        .sort(
          (a, b) => asNumber(b.data.performedAt) - asNumber(a.data.performedAt)
        )
        .slice(0, lim);
    },

    async querySetsPrForExercise(exerciseId) {
      const rows = listCol("sets").filter(
        (d) => d.data.exerciseId === exerciseId
      );
      if (rows.length === 0) return null;
      rows.sort((a, b) => {
        const wa = (a.data.weight as number) ?? 0;
        const wb = (b.data.weight as number) ?? 0;
        if (wb !== wa) return wb - wa;
        const ra = (a.data.reps as number) ?? 0;
        const rb = (b.data.reps as number) ?? 0;
        return rb - ra;
      });
      return rows[0];
    },

    async queryExercisesWhereDocumentIdIn(ids) {
      const set = new Set(ids);
      return listCol("exercises").filter((d) => set.has(d.id));
    },

    async queryTemplatesWhereDayIdIn(dayIds) {
      const set = new Set(dayIds);
      return listCol("exerciseSetTemplates").filter((d) =>
        set.has(d.data.dayId as string)
      );
    },

    async queryCollectionDocuments(collectionName, limitCount) {
      return listCol(collectionName).slice(0, limitCount);
    },

    async querySetsDocumentsForCsv(limitCount) {
      return listCol("sets")
        .sort(
          (a, b) => asNumber(b.data.performedAt) - asNumber(a.data.performedAt)
        )
        .slice(0, limitCount);
    },
  };

  return port;
}

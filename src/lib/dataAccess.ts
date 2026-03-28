import type { Firestore, Timestamp } from "firebase/firestore";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { endSaving, startSaving } from "./savingStore";
import type {
  CollectionName,
  Day,
  Exercise,
  ExerciseSetTemplate,
  Workout,
  WorkoutSet,
  TemplateWithExerciseName,
  WorkoutListItem,
} from "../types";

export interface DataAccessDeps {
  db: Firestore;
  saving: { start: () => void; end: () => void };
}

function withSaving<T>(
  saving: DataAccessDeps["saving"],
  fn: () => Promise<T>
): Promise<T> {
  saving.start();
  return (async () => {
    try {
      return await fn();
    } finally {
      saving.end();
    }
  })();
}

type DataWithTimestamps = Record<string, unknown> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

async function addDocument(
  firestore: Firestore,
  collectionName: CollectionName,
  data: Omit<DataWithTimestamps, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = collection(firestore, collectionName);
  const withTimestamps =
    collectionName === "sets"
      ? { ...data, createdAt: serverTimestamp() }
      : {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
  const docRef = await addDoc(ref, withTimestamps);
  return docRef.id;
}

async function patchDocument(
  firestore: Firestore,
  collectionName: CollectionName,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const ref = doc(firestore, collectionName, id);
  const payload =
    collectionName === "sets"
      ? data
      : { ...data, updatedAt: serverTimestamp() };
  // @ts-expect-error payload shape is valid at runtime
  await updateDoc(ref, payload);
}

async function removeDocument(
  firestore: Firestore,
  collectionName: CollectionName,
  id: string
): Promise<void> {
  await deleteDoc(doc(firestore, collectionName, id));
}

type Cascade = { collection: CollectionName; field: string };

async function removeDocumentAndRelated(
  firestore: Firestore,
  collectionName: CollectionName,
  id: string,
  cascades: Cascade[]
): Promise<void> {
  const batch = writeBatch(firestore);
  for (const { collection: childName, field } of cascades) {
    const childRef = collection(firestore, childName);
    const q = query(childRef, where(field, "==", id));
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
      batch.delete(d.ref);
    }
  }
  batch.delete(doc(firestore, collectionName, id));
  await batch.commit();
}

async function resolveExerciseNamesImpl(
  firestore: Firestore,
  exerciseIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(exerciseIds)];
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (eid) => {
      const snap = await getDoc(doc(firestore, "exercises", eid));
      if (snap.exists()) {
        map.set(eid, (snap.data() as Exercise).displayName);
      }
    })
  );
  return map;
}

const FIRESTORE_IN_MAX = 10;

async function templatesWithNamesForDayIds(
  firestore: Firestore,
  dayIds: string[]
): Promise<Map<string, TemplateWithExerciseName[]>> {
  if (dayIds.length === 0) return new Map();
  const dayIdSet = new Set(dayIds);
  const templatesRef = collection(firestore, "exerciseSetTemplates");
  const chunks: string[][] = [];
  for (let i = 0; i < dayIds.length; i += FIRESTORE_IN_MAX) {
    chunks.push(dayIds.slice(i, i + FIRESTORE_IN_MAX));
  }
  const tList: Array<ExerciseSetTemplate & { id: string }> = [];
  for (const chunk of chunks) {
    const tq = query(templatesRef, where("dayId", "in", chunk), limit(500));
    const tSnap = await getDocs(tq);
    tList.push(
      ...(tSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Array<ExerciseSetTemplate & { id: string }>)
    );
  }
  const forOurDays = tList
    .filter((t) => dayIdSet.has(t.dayId))
    .sort((a, b) =>
      a.dayId !== b.dayId ? a.dayId.localeCompare(b.dayId) : a.order - b.order
    );
  const exerciseIds = [...new Set(forOurDays.map((t) => t.exerciseId))];
  const nameMap = await resolveExerciseNamesImpl(firestore, exerciseIds);
  const byDay = new Map<string, TemplateWithExerciseName[]>();
  for (const t of forOurDays) {
    const row: TemplateWithExerciseName = {
      ...t,
      exerciseDisplayName: nameMap.get(t.exerciseId) ?? "—",
    };
    const list = byDay.get(t.dayId) ?? [];
    list.push(row);
    byDay.set(t.dayId, list);
  }
  return byDay;
}

export interface DataAccess {
  exercises: {
    get(id: string): Promise<Exercise | null>;
    searchByNamePrefix(prefix: string, max?: number): Promise<Exercise[]>;
    findByExactName(nameLower: string): Promise<Exercise | null>;
    create(input: { nameLower: string; displayName: string }): Promise<string>;
    update(
      id: string,
      patch: Partial<Pick<Exercise, "nameLower" | "displayName">>
    ): Promise<void>;
    delete(id: string): Promise<void>;
    list(opts: {
      sort: "asc" | "desc";
      search?: string;
      limit?: number;
    }): Promise<Array<Exercise & { id: string }>>;
  };
  days: {
    get(id: string): Promise<Day | null>;
    searchByNamePrefix(
      prefix: string,
      max?: number
    ): Promise<Array<Day & { id: string }>>;
    findByExactName(nameLower: string): Promise<Day | null>;
    create(input: { nameLower: string; displayName: string }): Promise<string>;
    update(
      id: string,
      patch: Partial<Pick<Day, "nameLower" | "displayName">>
    ): Promise<void>;
    deleteWithTemplates(id: string): Promise<void>;
    list(opts: {
      sort: "asc" | "desc";
      limit?: number;
    }): Promise<Array<Day & { id: string }>>;
  };
  templates: {
    listForDayWithExerciseNames(
      dayId: string
    ): Promise<TemplateWithExerciseName[]>;
    listForDaysWithExerciseNames(
      dayIds: string[]
    ): Promise<Map<string, TemplateWithExerciseName[]>>;
    create(
      input: Omit<ExerciseSetTemplate, "id" | "createdAt" | "updatedAt">
    ): Promise<string>;
    update(
      id: string,
      patch: Partial<
        Omit<ExerciseSetTemplate, "id" | "createdAt" | "updatedAt">
      >
    ): Promise<void>;
    delete(id: string): Promise<void>;
  };
  workouts: {
    get(id: string): Promise<(Workout & { id: string }) | null>;
    getWithSets(
      id: string
    ): Promise<{
      workout: Workout & { id: string };
      sets: WorkoutSet[];
    } | null>;
    create(input: {
      date: Timestamp;
      dayId: string;
      dayNameSnapshot: string;
      note?: string;
    }): Promise<string>;
    update(
      id: string,
      patch: Partial<
        Pick<Workout, "date" | "dayId" | "dayNameSnapshot" | "note">
      >
    ): Promise<void>;
    deleteWithSets(id: string): Promise<void>;
    getNotesByWorkoutIds(ids: string[]): Promise<Record<string, string>>;
    listWithStats(opts: {
      sort: "asc" | "desc";
      limit?: number;
    }): Promise<WorkoutListItem[]>;
  };
  sets: {
    listForWorkout(workoutId: string): Promise<WorkoutSet[]>;
    lastPerformedGroupForExercise(
      exerciseId: string,
      excludeWorkoutId?: string
    ): Promise<{
      sets: Array<{ reps: number; weight: number; note?: string }>;
      workoutId?: string;
    }>;
    listForExercise(
      exerciseId: string,
      opts?: { limit?: number }
    ): Promise<Array<WorkoutSet & { id: string }>>;
    prForExercise(
      exerciseId: string
    ): Promise<(WorkoutSet & { id: string }) | null>;
    create(input: Omit<WorkoutSet, "id" | "createdAt">): Promise<string>;
    update(
      id: string,
      patch: Partial<Omit<WorkoutSet, "id" | "createdAt">>
    ): Promise<void>;
    delete(id: string): Promise<void>;
  };
  resolveExerciseNames(ids: string[]): Promise<Map<string, string>>;
}

const DEFAULT_PAGE = 100;

export function createDataAccess(deps: DataAccessDeps): DataAccess {
  const { db: firestore, saving } = deps;

  return {
    exercises: {
      async get(id: string): Promise<Exercise | null> {
        const snap = await getDoc(doc(firestore, "exercises", id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as Exercise;
      },

      async searchByNamePrefix(prefix: string, max = 20): Promise<Exercise[]> {
        const term = prefix.trim().toLowerCase();
        if (!term) return [];
        const ref = collection(firestore, "exercises");
        const q = query(
          ref,
          where("nameLower", ">=", term),
          where("nameLower", "<=", term + "\uf8ff"),
          orderBy("nameLower"),
          limit(max)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Exercise[];
      },

      async findByExactName(nameLower: string): Promise<Exercise | null> {
        const ref = collection(firestore, "exercises");
        const q = query(ref, where("nameLower", "==", nameLower), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        const d = snap.docs[0];
        return { id: d.id, ...d.data() } as Exercise;
      },

      async create(input: {
        nameLower: string;
        displayName: string;
      }): Promise<string> {
        return withSaving(saving, () =>
          addDocument(firestore, "exercises", input as Record<string, unknown>)
        );
      },

      async update(
        id: string,
        patch: Partial<Pick<Exercise, "nameLower" | "displayName">>
      ): Promise<void> {
        return withSaving(saving, () =>
          patchDocument(firestore, "exercises", id, patch)
        );
      },

      async delete(id: string): Promise<void> {
        return withSaving(saving, () =>
          removeDocument(firestore, "exercises", id)
        );
      },

      async list(opts: {
        sort: "asc" | "desc";
        search?: string;
        limit?: number;
      }): Promise<Array<Exercise & { id: string }>> {
        const lim = opts.limit ?? DEFAULT_PAGE;
        const ref = collection(firestore, "exercises");
        const search = opts.search?.trim().toLowerCase();
        const q = search
          ? query(
              ref,
              where("nameLower", ">=", search),
              where("nameLower", "<=", search + "\uf8ff"),
              orderBy("nameLower", opts.sort),
              limit(lim)
            )
          : query(ref, orderBy("nameLower", opts.sort), limit(lim));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Array<Exercise & { id: string }>;
      },
    },

    days: {
      async get(id: string): Promise<Day | null> {
        const snap = await getDoc(doc(firestore, "days", id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as Day;
      },

      async searchByNamePrefix(
        prefix: string,
        max = 20
      ): Promise<Array<Day & { id: string }>> {
        const term = prefix.trim().toLowerCase();
        if (!term) return [];
        const ref = collection(firestore, "days");
        const q = query(
          ref,
          where("nameLower", ">=", term),
          where("nameLower", "<=", term + "\uf8ff"),
          orderBy("nameLower"),
          limit(max)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Array<Day & { id: string }>;
      },

      async findByExactName(nameLower: string): Promise<Day | null> {
        const ref = collection(firestore, "days");
        const q = query(ref, where("nameLower", "==", nameLower), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        const d = snap.docs[0];
        return { id: d.id, ...d.data() } as Day;
      },

      async create(input: {
        nameLower: string;
        displayName: string;
      }): Promise<string> {
        return withSaving(saving, () =>
          addDocument(firestore, "days", input as Record<string, unknown>)
        );
      },

      async update(
        id: string,
        patch: Partial<Pick<Day, "nameLower" | "displayName">>
      ): Promise<void> {
        return withSaving(saving, () =>
          patchDocument(firestore, "days", id, patch)
        );
      },

      async deleteWithTemplates(id: string): Promise<void> {
        return withSaving(saving, () =>
          removeDocumentAndRelated(firestore, "days", id, [
            { collection: "exerciseSetTemplates", field: "dayId" },
          ])
        );
      },

      async list(opts: {
        sort: "asc" | "desc";
        limit?: number;
      }): Promise<Array<Day & { id: string }>> {
        const lim = opts.limit ?? DEFAULT_PAGE;
        const ref = collection(firestore, "days");
        const q = query(ref, orderBy("nameLower", opts.sort), limit(lim));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Array<Day & { id: string }>;
      },
    },

    templates: {
      async listForDayWithExerciseNames(
        dayId: string
      ): Promise<TemplateWithExerciseName[]> {
        const map = await templatesWithNamesForDayIds(firestore, [dayId]);
        return map.get(dayId) ?? [];
      },

      async listForDaysWithExerciseNames(
        dayIds: string[]
      ): Promise<Map<string, TemplateWithExerciseName[]>> {
        return templatesWithNamesForDayIds(firestore, dayIds);
      },

      async create(
        input: Omit<ExerciseSetTemplate, "id" | "createdAt" | "updatedAt">
      ): Promise<string> {
        return withSaving(saving, () =>
          addDocument(
            firestore,
            "exerciseSetTemplates",
            input as Record<string, unknown>
          )
        );
      },

      async update(
        id: string,
        patch: Partial<
          Omit<ExerciseSetTemplate, "id" | "createdAt" | "updatedAt">
        >
      ): Promise<void> {
        return withSaving(saving, () =>
          patchDocument(firestore, "exerciseSetTemplates", id, patch)
        );
      },

      async delete(id: string): Promise<void> {
        return withSaving(saving, () =>
          removeDocument(firestore, "exerciseSetTemplates", id)
        );
      },
    },

    workouts: {
      async get(id: string): Promise<(Workout & { id: string }) | null> {
        const snap = await getDoc(doc(firestore, "workouts", id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as Workout & { id: string };
      },

      async getWithSets(id: string): Promise<{
        workout: Workout & { id: string };
        sets: WorkoutSet[];
      } | null> {
        const snap = await getDoc(doc(firestore, "workouts", id));
        if (!snap.exists()) return null;
        const workout = { id: snap.id, ...snap.data() } as Workout & {
          id: string;
        };
        const sq = query(
          collection(firestore, "sets"),
          where("workoutId", "==", id),
          orderBy("order"),
          limit(500)
        );
        const snapshot = await getDocs(sq);
        const sets = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as WorkoutSet[];
        return { workout, sets };
      },

      async create(input: {
        date: Timestamp;
        dayId: string;
        dayNameSnapshot: string;
        note?: string;
      }): Promise<string> {
        return withSaving(saving, () =>
          addDocument(firestore, "workouts", {
            ...input,
            note: input.note ?? "",
          } as Record<string, unknown>)
        );
      },

      async update(
        id: string,
        patch: Partial<
          Pick<Workout, "date" | "dayId" | "dayNameSnapshot" | "note">
        >
      ): Promise<void> {
        return withSaving(saving, () =>
          patchDocument(
            firestore,
            "workouts",
            id,
            patch as Record<string, unknown>
          )
        );
      },

      async deleteWithSets(id: string): Promise<void> {
        return withSaving(saving, () =>
          removeDocumentAndRelated(firestore, "workouts", id, [
            { collection: "sets", field: "workoutId" },
          ])
        );
      },

      async getNotesByWorkoutIds(
        ids: string[]
      ): Promise<Record<string, string>> {
        const notes: Record<string, string> = {};
        await Promise.all(
          ids.map(async (wid) => {
            const snap = await getDoc(doc(firestore, "workouts", wid));
            if (snap.exists()) {
              const note = (snap.data() as Workout).note;
              if (note) notes[wid] = note;
            }
          })
        );
        return notes;
      },

      async listWithStats(opts: {
        sort: "asc" | "desc";
        limit?: number;
      }): Promise<WorkoutListItem[]> {
        const lim = opts.limit ?? DEFAULT_PAGE;
        const ref = collection(firestore, "workouts");
        const q = query(ref, orderBy("date", opts.sort), limit(lim));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Array<Workout & { id: string }>;
        const withCounts = await Promise.all(
          list.map(async (w) => {
            const setsSnap = await getDocs(
              query(
                collection(firestore, "sets"),
                where("workoutId", "==", w.id)
              )
            );
            const exerciseIds = new Set<string>();
            let totalLoad = 0;
            setsSnap.docs.forEach((d) => {
              const data = d.data();
              exerciseIds.add(data.exerciseId as string);
              totalLoad +=
                ((data.reps as number) ?? 0) * ((data.weight as number) ?? 0);
            });
            return {
              ...w,
              setCount: setsSnap.size,
              exerciseCount: exerciseIds.size,
              totalLoad,
            } as WorkoutListItem;
          })
        );
        return withCounts;
      },
    },

    sets: {
      async listForWorkout(workoutId: string): Promise<WorkoutSet[]> {
        const q = query(
          collection(firestore, "sets"),
          where("workoutId", "==", workoutId),
          orderBy("order"),
          limit(500)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as WorkoutSet[];
      },

      async lastPerformedGroupForExercise(
        exerciseId: string,
        excludeWorkoutId?: string
      ): Promise<{
        sets: Array<{ reps: number; weight: number; note?: string }>;
        workoutId?: string;
      }> {
        const sq = query(
          collection(firestore, "sets"),
          where("exerciseId", "==", exerciseId),
          orderBy("performedAt", "desc"),
          limit(50)
        );
        const sSnap = await getDocs(sq);
        if (sSnap.empty) return { sets: [] };
        const docs = sSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Array<WorkoutSet & { id: string }>;
        const targetWorkoutId = docs.find(
          (d) => !excludeWorkoutId || d.workoutId !== excludeWorkoutId
        )?.workoutId;
        if (!targetWorkoutId) return { sets: [] };
        const group = docs
          .filter((d) => d.workoutId === targetWorkoutId)
          .sort((a, b) => a.order - b.order);
        return {
          sets: group.map((s) => ({
            reps: s.reps,
            weight: s.weight,
            note: s.note,
          })),
          workoutId: targetWorkoutId,
        };
      },

      async listForExercise(
        exerciseId: string,
        opts?: { limit?: number }
      ): Promise<Array<WorkoutSet & { id: string }>> {
        const lim = opts?.limit ?? 100;
        const setsRef = query(
          collection(firestore, "sets"),
          where("exerciseId", "==", exerciseId),
          orderBy("performedAt", "desc"),
          limit(lim)
        );
        const setsSnap = await getDocs(setsRef);
        return setsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Array<WorkoutSet & { id: string }>;
      },

      async prForExercise(
        exerciseId: string
      ): Promise<(WorkoutSet & { id: string }) | null> {
        const prRef = query(
          collection(firestore, "sets"),
          where("exerciseId", "==", exerciseId),
          orderBy("weight", "desc"),
          orderBy("reps", "desc"),
          limit(1)
        );
        const prSnap = await getDocs(prRef);
        if (prSnap.empty) return null;
        const d = prSnap.docs[0];
        return { id: d.id, ...d.data() } as WorkoutSet & { id: string };
      },

      async create(
        input: Omit<WorkoutSet, "id" | "createdAt">
      ): Promise<string> {
        return withSaving(saving, () =>
          addDocument(firestore, "sets", input as Record<string, unknown>)
        );
      },

      async update(
        id: string,
        patch: Partial<Omit<WorkoutSet, "id" | "createdAt">>
      ): Promise<void> {
        return withSaving(saving, () =>
          patchDocument(firestore, "sets", id, patch as Record<string, unknown>)
        );
      },

      async delete(id: string): Promise<void> {
        return withSaving(saving, () => removeDocument(firestore, "sets", id));
      },
    },

    resolveExerciseNames(ids: string[]): Promise<Map<string, string>> {
      return resolveExerciseNamesImpl(firestore, ids);
    },
  };
}

export const dataAccess: DataAccess = createDataAccess({
  db,
  saving: { start: startSaving, end: endSaving },
});

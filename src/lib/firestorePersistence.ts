/**
 * Firebase SDK write helpers (timestamps, serialization, cascaded deletes).
 * Call only from {@link createFirebaseFirestoreDataPort}; do not import from
 * slices, pages, or other app modules — keep mutations behind FirestoreDataPort.
 */
import type {
  DocumentReference,
  Firestore,
  Timestamp,
} from "firebase/firestore";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type WriteBatch,
} from "firebase/firestore";
import type { CollectionName } from "../types";
import { writePayload } from "./firestoreDocSerialize";
import {
  assertPlanWithinBatchLimit,
  planExerciseSetReconcile,
} from "./setEntry/planExerciseSetReconcile";

type DataWithTimestamps = Record<string, unknown> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export async function addDocument(
  firestore: Firestore,
  collectionName: CollectionName,
  data: Omit<DataWithTimestamps, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = collection(firestore, collectionName);
  const serialized = writePayload(data as Record<string, unknown>);
  const withTimestamps =
    collectionName === "sets"
      ? { ...serialized, createdAt: serverTimestamp() }
      : {
          ...serialized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
  const docRef = await addDoc(ref, withTimestamps);
  return docRef.id;
}

export async function patchDocument(
  firestore: Firestore,
  collectionName: CollectionName,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const ref = doc(firestore, collectionName, id);
  const serialized = writePayload(data);
  const payload =
    collectionName === "sets"
      ? serialized
      : { ...serialized, updatedAt: serverTimestamp() };
  await updateDoc(ref, payload);
}

export async function patchDocuments(
  firestore: Firestore,
  patches: Array<{
    collectionName: CollectionName;
    id: string;
    data: Record<string, unknown>;
  }>
): Promise<void> {
  if (patches.length === 0) return;

  const batch = writeBatch(firestore);
  for (const { collectionName, id, data } of patches) {
    const ref = doc(firestore, collectionName, id);
    const serialized = writePayload(data);
    const payload =
      collectionName === "sets"
        ? serialized
        : { ...serialized, updatedAt: serverTimestamp() };
    // Firestore accepts Timestamp and FieldValue in update payloads.
    batch.update(ref, payload as never);
  }
  await batch.commit();
}

export async function removeDocument(
  firestore: Firestore,
  collectionName: CollectionName,
  id: string
): Promise<void> {
  await deleteDoc(doc(firestore, collectionName, id));
}

type Cascade = { collection: CollectionName; field: string };

export async function removeDocumentAndRelated(
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

const FIRESTORE_BATCH_MAX_OPS = 500;

/**
 * Updates workout `date` and sets every set's `performedAt` for that workout.
 * Commits in chunks of at most {@link FIRESTORE_BATCH_MAX_OPS} writes each.
 */
export async function syncWorkoutDateAndSetsPerformedAt(
  firestore: Firestore,
  workoutId: string,
  date: Date
): Promise<void> {
  const workoutRef = doc(firestore, "workouts", workoutId);
  const dateSerialized = writePayload({ date });
  const workoutUpdate = {
    ...dateSerialized,
    updatedAt: serverTimestamp(),
  };

  const setsSnap = await getDocs(
    query(collection(firestore, "sets"), where("workoutId", "==", workoutId))
  );
  const performedSerialized = writePayload({ performedAt: date });

  let batch: WriteBatch = writeBatch(firestore);
  let opCount = 0;

  const flush = async () => {
    if (opCount === 0) return;
    await batch.commit();
    batch = writeBatch(firestore);
    opCount = 0;
  };

  const enqueueUpdate = async (
    ref: DocumentReference,
    data: Record<string, unknown>
  ) => {
    if (opCount >= FIRESTORE_BATCH_MAX_OPS) await flush();
    // Firestore accepts Timestamp and FieldValue in update payloads.
    batch.update(ref, data as never);
    opCount += 1;
  };

  await enqueueUpdate(workoutRef, workoutUpdate);

  for (const d of setsSnap.docs) {
    await enqueueUpdate(d.ref, performedSerialized);
  }

  await flush();
}

export type PersistReconcileExerciseSetsInput = {
  workoutId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  performedAt: Date;
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
};

/**
 * Atomically reconcile one exercise's Sets (create/update/delete + order patches).
 * Never splits across batches — throws if the op count exceeds the limit.
 */
export async function reconcileExerciseSets(
  firestore: Firestore,
  input: PersistReconcileExerciseSetsInput
): Promise<{ createdIds: string[] }> {
  const existingForExercise = input.currentSets.filter(
    (s) => s.exerciseId === input.exerciseId
  );
  const plan = planExerciseSetReconcile({
    desired: input.desiredSets,
    existingForExercise,
    allWorkoutSets: input.currentSets,
    exerciseId: input.exerciseId,
    exerciseOrder: input.exerciseOrder,
  });
  assertPlanWithinBatchLimit(plan);

  const batch = writeBatch(firestore);
  const createdIds: string[] = [];
  const setsCol = collection(firestore, "sets");

  for (const create of plan.creates) {
    const ref = doc(setsCol);
    createdIds.push(ref.id);
    const payload = writePayload({
      workoutId: input.workoutId,
      exerciseId: input.exerciseId,
      exerciseNameSnapshot: input.exerciseNameSnapshot,
      reps: create.reps,
      weight: create.weight,
      unit: "lbs",
      note: create.note,
      performedAt: input.performedAt,
      order: create.order,
      createdAt: serverTimestamp(),
    });
    batch.set(ref, payload);
  }

  for (const update of plan.updates) {
    const ref = doc(firestore, "sets", update.id);
    batch.update(
      ref,
      writePayload({
        reps: update.reps,
        weight: update.weight,
        note: update.note,
        order: update.order,
        performedAt: input.performedAt,
        exerciseNameSnapshot: input.exerciseNameSnapshot,
      }) as never
    );
  }

  for (const del of plan.deletes) {
    batch.delete(doc(firestore, "sets", del.id));
  }

  for (const patch of plan.otherOrderPatches) {
    batch.update(
      doc(firestore, "sets", patch.id),
      writePayload({ order: patch.order }) as never
    );
  }

  if (plan.operationCount > 0) {
    await batch.commit();
  }
  return { createdIds };
}

export type PersistCopyWorkoutWithSetsInput = {
  workout: {
    date: Date;
    dayId: string;
    dayNameSnapshot: string;
    note?: string;
  };
  sets: Array<{
    exerciseId: string;
    exerciseNameSnapshot: string;
    reps: number;
    weight: number;
    unit?: string;
    order: number;
  }>;
};

/**
 * Atomically create a Workout and all of its Sets in one batch.
 * Throws if the write count exceeds Firestore's batch limit.
 */
export async function copyWorkoutWithSets(
  firestore: Firestore,
  input: PersistCopyWorkoutWithSetsInput
): Promise<{ workoutId: string; setIds: string[] }> {
  const opCount = 1 + input.sets.length;
  if (opCount > FIRESTORE_BATCH_MAX_OPS) {
    throw new Error(
      `Workout copy requires ${opCount} writes, exceeding Firestore's batch limit of ${FIRESTORE_BATCH_MAX_OPS}`
    );
  }

  const batch = writeBatch(firestore);
  const workoutRef = doc(collection(firestore, "workouts"));
  const workoutPayload = writePayload({
    date: input.workout.date,
    dayId: input.workout.dayId,
    dayNameSnapshot: input.workout.dayNameSnapshot,
    note: input.workout.note ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(workoutRef, workoutPayload);

  const setIds: string[] = [];
  const setsCol = collection(firestore, "sets");
  for (const s of input.sets) {
    const setRef = doc(setsCol);
    setIds.push(setRef.id);
    batch.set(
      setRef,
      writePayload({
        workoutId: workoutRef.id,
        exerciseId: s.exerciseId,
        exerciseNameSnapshot: s.exerciseNameSnapshot,
        reps: s.reps,
        weight: s.weight,
        unit: s.unit ?? "lbs",
        note: "",
        performedAt: input.workout.date,
        order: s.order,
        createdAt: serverTimestamp(),
      })
    );
  }

  await batch.commit();
  return { workoutId: workoutRef.id, setIds };
}

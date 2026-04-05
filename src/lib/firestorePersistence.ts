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
  // @ts-expect-error payload shape is valid at runtime
  await updateDoc(ref, payload);
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

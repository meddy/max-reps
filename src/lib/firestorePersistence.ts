/**
 * Firebase SDK write helpers (timestamps, serialization, cascaded deletes).
 * Call only from {@link createFirebaseFirestoreDataPort}; do not import from
 * slices, pages, or other app modules — keep mutations behind FirestoreDataPort.
 */
import type { Firestore, Timestamp } from "firebase/firestore";
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

import {
  type CollectionReference,
  type DocumentReference,
  type Timestamp,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  limit,
  serverTimestamp,
  writeBatch,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { CollectionName } from "../types";

export function getCollectionRef(name: CollectionName): CollectionReference {
  return collection(db, name);
}

export function getDocRef(
  collectionName: CollectionName,
  id: string
): DocumentReference {
  return doc(db, collectionName, id);
}

type DataWithTimestamps = Record<string, unknown> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export async function createDoc<T extends DataWithTimestamps>(
  collectionName: CollectionName,
  data: Omit<T, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = collection(db, collectionName);
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

export async function updateDocById(
  collectionName: CollectionName,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const ref = doc(db, collectionName, id);
  const payload =
    collectionName === "sets"
      ? data
      : { ...data, updatedAt: serverTimestamp() };
  // Firebase updateDoc expects FieldValue for some keys; we pass timestamps and primitives
  // @ts-expect-error payload shape is valid at runtime
  await updateDoc(ref, payload);
}

type Cascade = { collection: CollectionName; field: string };

export async function deleteDocById(
  collectionName: CollectionName,
  id: string
): Promise<void> {
  const ref = doc(db, collectionName, id);
  await deleteDoc(ref);
}

export async function deleteDocAndRelated(
  collectionName: CollectionName,
  id: string,
  cascades: Cascade[]
): Promise<void> {
  const batch = writeBatch(db);

  for (const { collection: childName, field } of cascades) {
    const childRef = collection(db, childName);
    const q = query(childRef, where(field, "==", id));
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
      batch.delete(d.ref);
    }
  }

  const docRef = doc(db, collectionName, id);
  batch.delete(docRef);
  await batch.commit();
}

export { getDoc, getDocs, query, where, orderBy, limit, serverTimestamp };

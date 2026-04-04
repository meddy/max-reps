import {
  type CollectionReference,
  type DocumentReference,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  limit,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { CollectionName } from "../types";
import { removeDocumentAndRelated as removeDocumentAndRelatedImpl } from "./firestoreWrites";

export function getCollectionRef(name: CollectionName): CollectionReference {
  return collection(db, name);
}

export function getDocRef(
  collectionName: CollectionName,
  id: string
): DocumentReference {
  return doc(db, collectionName, id);
}

type Cascade = { collection: CollectionName; field: string };

export async function deleteDocAndRelated(
  collectionName: CollectionName,
  id: string,
  cascades: Cascade[]
): Promise<void> {
  return removeDocumentAndRelatedImpl(db, collectionName, id, cascades);
}

export { getDoc, getDocs, query, where, orderBy, limit, serverTimestamp };

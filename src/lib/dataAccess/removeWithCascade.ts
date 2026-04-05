import type { CollectionName } from "../../types";
import type { FirestoreDataPort } from "../firestoreDataPort/types";

export type CascadeDeleteFirestorePort = Pick<
  FirestoreDataPort,
  "removeDocumentAndRelated"
>;
import {
  cascadesForDayDelete,
  cascadesForWorkoutDelete,
} from "./cascadePolicy";

export type CascadeDeleteKey = "day" | "workout";

const ROOT_COLLECTION: Record<CascadeDeleteKey, CollectionName> = {
  day: "days",
  workout: "workouts",
};

const CASCADES = {
  day: cascadesForDayDelete,
  workout: cascadesForWorkoutDelete,
} as const;

/** Single entry for parent deletes that cascade to child collections. */
export function removeWithCascade(
  port: CascadeDeleteFirestorePort,
  key: CascadeDeleteKey,
  id: string
): Promise<void> {
  const collectionName = ROOT_COLLECTION[key];
  return port.removeDocumentAndRelated(collectionName, id, CASCADES[key]);
}

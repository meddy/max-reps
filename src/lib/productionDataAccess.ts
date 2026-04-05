import { db } from "./firebase";
import { createDataAccess } from "./dataAccess/createDataAccess";
import { createFirebaseFirestoreDataPort } from "./firestoreDataPort/firebaseAdapter";
import { endSaving, startSaving } from "./savingStore";
import type { DataAccess } from "./dataAccess/types";

let cached: DataAccess | null = null;

/**
 * Lazily constructs the production `DataAccess` singleton so importing
 * `createDataAccess` / slice modules does not pull in Firebase.
 */
export function getDefaultDataAccess(): DataAccess {
  if (!cached) {
    cached = createDataAccess({
      firestore: createFirebaseFirestoreDataPort(db),
      saving: { start: startSaving, end: endSaving },
    });
  }
  return cached;
}

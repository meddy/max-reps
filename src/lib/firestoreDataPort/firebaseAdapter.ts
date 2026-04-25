import type { Firestore } from "firebase/firestore";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  addDocument as persistAddDocument,
  patchDocument as persistPatchDocument,
  patchDocuments as persistPatchDocuments,
  removeDocument as persistRemoveDocument,
  removeDocumentAndRelated as persistRemoveDocumentAndRelated,
  syncWorkoutDateAndSetsPerformedAt as persistSyncWorkoutDateAndSetsPerformedAt,
} from "../firestorePersistence";
import type { FirestoreDataPort, RawDoc } from "./types";

const FIRESTORE_IN_MAX = 10;

function toRawDoc(
  id: string,
  data: Record<string, unknown> | undefined
): RawDoc {
  return { id, data: data ?? {} };
}

export function createFirebaseFirestoreDataPort(
  db: Firestore
): FirestoreDataPort {
  return {
    async getDocument(collectionName, id) {
      const snap = await getDoc(doc(db, collectionName, id));
      if (!snap.exists()) return null;
      return toRawDoc(snap.id, snap.data() as Record<string, unknown>);
    },

    addDocument(collectionName, data) {
      return persistAddDocument(
        db,
        collectionName,
        data as Parameters<typeof persistAddDocument>[2]
      );
    },

    patchDocument(collectionName, id, data) {
      return persistPatchDocument(db, collectionName, id, data);
    },

    patchDocuments(patches) {
      return persistPatchDocuments(db, patches);
    },

    removeDocument(collectionName, id) {
      return persistRemoveDocument(db, collectionName, id);
    },

    removeDocumentAndRelated(collectionName, id, cascades) {
      return persistRemoveDocumentAndRelated(
        db,
        collectionName,
        id,
        cascades as Parameters<typeof persistRemoveDocumentAndRelated>[3]
      );
    },

    syncWorkoutDateAndSetsPerformedAt(workoutId, date) {
      return persistSyncWorkoutDateAndSetsPerformedAt(db, workoutId, date);
    },

    async queryExercisesByNamePrefix(term, max) {
      const ref = collection(db, "exercises");
      const q = query(
        ref,
        where("nameLower", ">=", term),
        where("nameLower", "<=", term + "\uf8ff"),
        orderBy("nameLower"),
        limit(max)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) =>
        toRawDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async queryExerciseByNameLowerEqual(nameLower) {
      const ref = collection(db, "exercises");
      const q = query(ref, where("nameLower", "==", nameLower), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return toRawDoc(d.id, d.data() as Record<string, unknown>);
    },

    async queryExercisesList(opts) {
      const ref = collection(db, "exercises");
      const search = opts.search?.trim().toLowerCase();
      const q = search
        ? query(
            ref,
            where("nameLower", ">=", search),
            where("nameLower", "<=", search + "\uf8ff"),
            orderBy("nameLower", opts.sort),
            limit(opts.limit)
          )
        : query(ref, orderBy("nameLower", opts.sort), limit(opts.limit));
      const snap = await getDocs(q);
      return snap.docs.map((d) =>
        toRawDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async queryDaysByNamePrefix(term, max) {
      const ref = collection(db, "days");
      const q = query(
        ref,
        where("nameLower", ">=", term),
        where("nameLower", "<=", term + "\uf8ff"),
        orderBy("nameLower"),
        limit(max)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) =>
        toRawDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async queryDayByNameLowerEqual(nameLower) {
      const ref = collection(db, "days");
      const q = query(ref, where("nameLower", "==", nameLower), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return toRawDoc(d.id, d.data() as Record<string, unknown>);
    },

    async queryDaysList(opts) {
      const ref = collection(db, "days");
      const q = query(ref, orderBy("nameLower", opts.sort), limit(opts.limit));
      const snap = await getDocs(q);
      return snap.docs.map((d) =>
        toRawDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async querySetsForWorkoutOrdered(workoutId) {
      const q = query(
        collection(db, "sets"),
        where("workoutId", "==", workoutId),
        orderBy("order"),
        limit(500)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) =>
        toRawDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async queryWorkoutsByDate(opts) {
      const ref = collection(db, "workouts");
      const q = query(ref, orderBy("date", opts.sort), limit(opts.limit));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) =>
        toRawDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async queryWorkoutsByDayBeforeDate(dayId, beforeDate, lim) {
      const ref = collection(db, "workouts");
      try {
        const q = query(
          ref,
          where("dayId", "==", dayId),
          where("date", "<", beforeDate),
          orderBy("date", "desc"),
          limit(lim)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) =>
          toRawDoc(d.id, d.data() as Record<string, unknown>)
        );
      } catch (error: unknown) {
        const code =
          typeof error === "object" && error && "code" in error
            ? String((error as { code?: unknown }).code)
            : "";
        if (code !== "failed-precondition") {
          throw error;
        }
      }

      // Fallback: use date-ordered query and filter in memory.
      const fallback = query(ref, orderBy("date", "desc"), limit(500));
      const snapshot = await getDocs(fallback);
      const filtered = snapshot.docs
        .filter((d) => {
          const data = d.data() as Record<string, unknown>;
          const date = data.date as Date | { toDate: () => Date } | undefined;
          const dateValue =
            date instanceof Date
              ? date
              : date && typeof date === "object" && "toDate" in date
                ? (date as { toDate: () => Date }).toDate()
                : null;
          return (
            data.dayId === dayId &&
            dateValue != null &&
            dateValue.getTime() < beforeDate.getTime()
          );
        })
        .slice(0, lim);
      return filtered.map((d) =>
        toRawDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async querySetsByWorkoutId(workoutId) {
      const setsSnap = await getDocs(
        query(collection(db, "sets"), where("workoutId", "==", workoutId))
      );
      return setsSnap.docs.map((d) =>
        toRawDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async querySetsByExercisePerformedAtDesc(exerciseId, lim) {
      const setsRef = query(
        collection(db, "sets"),
        where("exerciseId", "==", exerciseId),
        orderBy("performedAt", "desc"),
        limit(lim)
      );
      const setsSnap = await getDocs(setsRef);
      return setsSnap.docs.map((d) =>
        toRawDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async querySetsPrForExercise(exerciseId) {
      const prRef = query(
        collection(db, "sets"),
        where("exerciseId", "==", exerciseId),
        orderBy("weight", "desc"),
        orderBy("reps", "desc"),
        limit(1)
      );
      const prSnap = await getDocs(prRef);
      if (prSnap.empty) return null;
      const d = prSnap.docs[0];
      return toRawDoc(d.id, d.data() as Record<string, unknown>);
    },

    async queryExercisesWhereDocumentIdIn(ids) {
      const unique = [...new Set(ids)];
      const out: RawDoc[] = [];
      const exercisesRef = collection(db, "exercises");
      for (let i = 0; i < unique.length; i += FIRESTORE_IN_MAX) {
        const chunk = unique.slice(i, i + FIRESTORE_IN_MAX);
        const q = query(exercisesRef, where(documentId(), "in", chunk));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          out.push(toRawDoc(d.id, d.data() as Record<string, unknown>));
        }
      }
      return out;
    },

    async queryTemplatesWhereDayIdIn(dayIds) {
      if (dayIds.length === 0) return [];
      const templatesRef = collection(db, "exerciseSetTemplates");
      const tList: RawDoc[] = [];
      for (let i = 0; i < dayIds.length; i += FIRESTORE_IN_MAX) {
        const chunk = dayIds.slice(i, i + FIRESTORE_IN_MAX);
        const tq = query(templatesRef, where("dayId", "in", chunk), limit(500));
        const tSnap = await getDocs(tq);
        for (const d of tSnap.docs) {
          tList.push(toRawDoc(d.id, d.data() as Record<string, unknown>));
        }
      }
      return tList;
    },

    async queryCollectionDocuments(collectionName, limitCount) {
      const ref = collection(db, collectionName);
      const q = query(ref, limit(limitCount));
      const snap = await getDocs(q);
      return snap.docs.map((d) =>
        toRawDoc(d.id, d.data() as Record<string, unknown>)
      );
    },

    async querySetsDocumentsForCsv(limitCount) {
      const ref = collection(db, "sets");
      const q = query(ref, orderBy("performedAt", "desc"), limit(limitCount));
      const snap = await getDocs(q);
      return snap.docs.map((d) =>
        toRawDoc(d.id, d.data() as Record<string, unknown>)
      );
    },
  };
}

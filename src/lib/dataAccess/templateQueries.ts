import type { Firestore } from "firebase/firestore";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import type {
  ExerciseSetTemplate,
  TemplateWithExerciseName,
} from "../../types";
import { mapTemplateFromDoc } from "../firestoreModelMappers";

const FIRESTORE_IN_MAX = 10;

export async function resolveExerciseNamesImpl(
  firestore: Firestore,
  exerciseIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(exerciseIds)];
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (eid) => {
      const snap = await getDoc(doc(firestore, "exercises", eid));
      if (snap.exists()) {
        const name = (snap.data() as { displayName?: string }).displayName;
        if (name) map.set(eid, name);
      }
    })
  );
  return map;
}

export async function templatesWithNamesForDayIds(
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
      ...tSnap.docs.map((d) =>
        mapTemplateFromDoc(d.id, d.data() as Record<string, unknown>)
      )
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

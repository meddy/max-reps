import type {
  ExerciseSetTemplate,
  TemplateWithExerciseName,
} from "../../types";
import type {
  ResolveDayExistenceFirestorePort,
  ResolveExerciseNamesFirestorePort,
  TemplatesWithNamesFirestorePort,
} from "../firestoreDataPort/types";
import { mapTemplateFromDoc } from "../firestoreModelMappers";

export async function resolveExerciseNamesImpl(
  firestore: ResolveExerciseNamesFirestorePort,
  exerciseIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(exerciseIds)];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const docs = await firestore.queryExercisesWhereDocumentIdIn(unique);
  for (const d of docs) {
    const name = d.data.displayName as string | undefined;
    if (name) map.set(d.id, name);
  }
  return map;
}

/** Map of dayId → whether the Day document still exists. */
export async function resolveDayExistenceImpl(
  firestore: ResolveDayExistenceFirestorePort,
  dayIds: string[]
): Promise<Map<string, boolean>> {
  const unique = [...new Set(dayIds.filter(Boolean))];
  const map = new Map<string, boolean>();
  if (unique.length === 0) return map;
  const docs = await firestore.queryDaysWhereDocumentIdIn(unique);
  const found = new Set(docs.map((d) => d.id));
  for (const id of unique) {
    map.set(id, found.has(id));
  }
  return map;
}

export async function templatesWithNamesForDayIds(
  firestore: TemplatesWithNamesFirestorePort,
  dayIds: string[]
): Promise<Map<string, TemplateWithExerciseName[]>> {
  if (dayIds.length === 0) return new Map();
  const dayIdSet = new Set(dayIds);
  const rawList = await firestore.queryTemplatesWhereDayIdIn(dayIds);
  const tList: Array<ExerciseSetTemplate & { id: string }> = rawList.map((d) =>
    mapTemplateFromDoc(d.id, d.data)
  );
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

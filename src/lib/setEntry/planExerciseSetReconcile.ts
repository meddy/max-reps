import type { ParsedSet } from "./parseSetEntry";

export type ExistingExerciseSet = {
  id: string;
  reps: number;
  weight: number;
  note: string;
  order: number;
};

export type SetReconcileCreate = {
  op: "create";
  reps: number;
  weight: number;
  note: string;
  order: number;
};

export type SetReconcileUpdate = {
  op: "update";
  id: string;
  reps: number;
  weight: number;
  note: string;
  order: number;
};

export type SetReconcileDelete = {
  op: "delete";
  id: string;
};

export type SetOrderPatch = {
  id: string;
  order: number;
};

export type SetReconcilePlan = {
  creates: SetReconcileCreate[];
  updates: SetReconcileUpdate[];
  deletes: SetReconcileDelete[];
  /** Order patches for Sets belonging to other exercises in the same Workout. */
  otherOrderPatches: SetOrderPatch[];
  /** Total write operations that would be issued in one batch. */
  operationCount: number;
};

export const FIRESTORE_BATCH_LIMIT = 500;

/**
 * Plan an atomic reconciliation of one exercise's Sets within a Workout using
 * the editor's exercise order. Global `order` is a single sequence: Sets for
 * exerciseOrder[0], then exerciseOrder[1], …
 */
export function planExerciseSetReconcile(input: {
  desired: ReadonlyArray<ParsedSet>;
  existingForExercise: ReadonlyArray<ExistingExerciseSet>;
  allWorkoutSets: ReadonlyArray<{
    id: string;
    exerciseId: string;
    order: number;
  }>;
  exerciseId: string;
  exerciseOrder: ReadonlyArray<string>;
}): SetReconcilePlan {
  const {
    desired,
    existingForExercise,
    allWorkoutSets,
    exerciseId,
    exerciseOrder,
  } = input;

  const sortedExisting = [...existingForExercise].sort(
    (a, b) => a.order - b.order
  );
  const creates: SetReconcileCreate[] = [];
  const updates: SetReconcileUpdate[] = [];
  const deletes: SetReconcileDelete[] = [];

  const setsByExercise = new Map<
    string,
    Array<{ id: string; exerciseId: string; order: number }>
  >();
  for (const set of allWorkoutSets) {
    const list = setsByExercise.get(set.exerciseId) ?? [];
    list.push(set);
    setsByExercise.set(set.exerciseId, list);
  }
  for (const list of setsByExercise.values()) {
    list.sort((a, b) => a.order - b.order);
  }

  let nextOrder = 0;
  const finalOrders = new Map<string, number>();
  const createOrders: number[] = [];

  for (const eid of exerciseOrder) {
    if (eid === exerciseId) {
      const reuseCount = Math.min(desired.length, sortedExisting.length);
      for (let i = 0; i < reuseCount; i++) {
        finalOrders.set(sortedExisting[i].id, nextOrder);
        nextOrder += 1;
      }
      for (let i = reuseCount; i < desired.length; i++) {
        createOrders.push(nextOrder);
        nextOrder += 1;
      }
      continue;
    }
    const other = setsByExercise.get(eid) ?? [];
    for (const s of other) {
      finalOrders.set(s.id, nextOrder);
      nextOrder += 1;
    }
  }

  for (const [eid, list] of setsByExercise) {
    if (exerciseOrder.includes(eid) || eid === exerciseId) continue;
    for (const s of list) {
      if (!finalOrders.has(s.id)) {
        finalOrders.set(s.id, nextOrder);
        nextOrder += 1;
      }
    }
  }

  const reuseCount = Math.min(desired.length, sortedExisting.length);
  for (let i = 0; i < reuseCount; i++) {
    const existing = sortedExisting[i];
    const next = desired[i];
    updates.push({
      op: "update",
      id: existing.id,
      reps: next.reps,
      weight: next.weight,
      note: next.note,
      order: finalOrders.get(existing.id)!,
    });
  }
  for (let i = reuseCount; i < desired.length; i++) {
    const next = desired[i];
    creates.push({
      op: "create",
      reps: next.reps,
      weight: next.weight,
      note: next.note,
      order: createOrders[i - reuseCount]!,
    });
  }
  for (let i = reuseCount; i < sortedExisting.length; i++) {
    deletes.push({ op: "delete", id: sortedExisting[i].id });
  }

  const deletedIds = new Set(deletes.map((d) => d.id));
  const otherOrderPatches: SetOrderPatch[] = [];
  for (const set of allWorkoutSets) {
    if (set.exerciseId === exerciseId) continue;
    if (deletedIds.has(set.id)) continue;
    const desiredOrder = finalOrders.get(set.id);
    if (desiredOrder === undefined) continue;
    if (desiredOrder !== set.order) {
      otherOrderPatches.push({ id: set.id, order: desiredOrder });
    }
  }

  const operationCount =
    creates.length + updates.length + deletes.length + otherOrderPatches.length;

  return {
    creates,
    updates,
    deletes,
    otherOrderPatches,
    operationCount,
  };
}

export function assertPlanWithinBatchLimit(plan: SetReconcilePlan): void {
  if (plan.operationCount > FIRESTORE_BATCH_LIMIT) {
    throw new Error(
      `Set reconciliation requires ${plan.operationCount} writes, exceeding Firestore's batch limit of ${FIRESTORE_BATCH_LIMIT}`
    );
  }
}

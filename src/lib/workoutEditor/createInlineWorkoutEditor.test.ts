import { describe, expect, it, vi } from "vitest";
import type {
  Day,
  TemplateWithExerciseName,
  Workout,
  WorkoutSet,
} from "../../types";
import {
  createInlineWorkoutEditor,
  type InlineEditorPersistence,
} from "./createInlineWorkoutEditor";

const now = new Date("2026-07-18T12:00:00Z");

function day(id: string, displayName: string): Day {
  return {
    id,
    nameLower: displayName.toLowerCase(),
    displayName,
    createdAt: now,
    updatedAt: now,
  };
}

function workout(overrides: Partial<Workout> & { id: string }): Workout & {
  id: string;
} {
  return {
    date: now,
    dayId: "day-a",
    dayNameSnapshot: "Push",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function set(
  overrides: Partial<WorkoutSet> & {
    id: string;
    exerciseId: string;
    exerciseNameSnapshot: string;
  }
): WorkoutSet {
  return {
    workoutId: "w1",
    reps: 5,
    weight: 225,
    unit: "lbs",
    note: "",
    performedAt: now,
    order: 0,
    createdAt: now,
    ...overrides,
  };
}

function template(
  overrides: Partial<TemplateWithExerciseName> & {
    id: string;
    dayId: string;
    exerciseId: string;
    exerciseDisplayName: string;
    order: number;
  }
): TemplateWithExerciseName {
  return {
    numSets: 3,
    repsLower: 5,
    repsUpper: 8,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function stubPersistence(): InlineEditorPersistence {
  return {
    updateWorkout: vi.fn(async () => {}),
    reconcileExercise: vi.fn(async () => ({ createdIds: [] })),
    reorderAllSets: vi.fn(async () => {}),
  };
}

function createEditor(opts?: {
  workout?: Workout & { id: string };
  sets?: WorkoutSet[];
  persistence?: InlineEditorPersistence;
  debounceMs?: number;
}) {
  return createInlineWorkoutEditor({
    workout: opts?.workout ?? workout({ id: "w1" }),
    sets: opts?.sets ?? [],
    persistence: opts?.persistence ?? stubPersistence(),
    getPerformedAt: () => now,
    debounceMs: opts?.debounceMs ?? 10_000,
  });
}

describe("applyDaySelection", () => {
  it("Day A → Day B: drops blanks, keeps logged/non-empty, fills B, syncs hints", () => {
    const editor = createEditor({
      sets: [
        set({
          id: "s1",
          exerciseId: "bench",
          exerciseNameSnapshot: "Bench",
          order: 0,
        }),
      ],
    });

    // Simulate Push fill: OHP blank + Bench already present with Push hint.
    editor.fillFromDay([
      template({
        id: "t-bench",
        dayId: "day-a",
        exerciseId: "bench",
        exerciseDisplayName: "Bench",
        order: 0,
        numSets: 3,
        repsLower: 5,
        repsUpper: 8,
      }),
      template({
        id: "t-ohp",
        dayId: "day-a",
        exerciseId: "ohp",
        exerciseDisplayName: "OHP",
        order: 1,
      }),
    ]);
    editor.addExercise("custom", "Face Pulls");
    // Non-empty unsaved draft should be kept.
    const face = editor
      .getSnapshot()
      .drafts.find((d) => d.exerciseId === "custom")!;
    editor.setText(face.localId, "3x20");

    const legs = day("day-b", "Legs");
    editor.applyDaySelection(legs, [
      template({
        id: "t-squat",
        dayId: "day-b",
        exerciseId: "squat",
        exerciseDisplayName: "Squat",
        order: 0,
        numSets: 4,
        repsLower: 3,
        repsUpper: 5,
      }),
      template({
        id: "t-bench-legs",
        dayId: "day-b",
        exerciseId: "bench",
        exerciseDisplayName: "Bench",
        order: 1,
        numSets: 2,
        repsLower: 8,
        repsUpper: 12,
      }),
    ]);

    const snap = editor.getSnapshot();
    expect(snap.workout.dayId).toBe("day-b");
    expect(snap.workout.dayNameSnapshot).toBe("Legs");

    const byEx = Object.fromEntries(snap.drafts.map((d) => [d.exerciseId, d]));
    expect(byEx.ohp).toBeUndefined();
    expect(byEx.bench).toBeDefined();
    expect(byEx.bench!.setIds).toEqual(["s1"]);
    expect(byEx.bench!.setTargetLabel).toBe("2 × 8–12");
    expect(byEx.custom).toBeDefined();
    expect(byEx.custom!.text).toBe("3x20");
    expect(byEx.custom!.setTargetLabel).toBeUndefined();
    expect(byEx.squat).toBeDefined();
    expect(byEx.squat!.isEmpty).toBe(true);
    expect(byEx.squat!.setTargetLabel).toBe("4 × 3–5");
  });

  it("Day → No Day: drops blanks and clears all hints", () => {
    const editor = createEditor({
      sets: [
        set({
          id: "s1",
          exerciseId: "bench",
          exerciseNameSnapshot: "Bench",
          order: 0,
        }),
      ],
    });
    editor.fillFromDay([
      template({
        id: "t-bench",
        dayId: "day-a",
        exerciseId: "bench",
        exerciseDisplayName: "Bench",
        order: 0,
      }),
      template({
        id: "t-ohp",
        dayId: "day-a",
        exerciseId: "ohp",
        exerciseDisplayName: "OHP",
        order: 1,
      }),
    ]);

    editor.applyDaySelection(null, []);

    const snap = editor.getSnapshot();
    expect(snap.workout.dayId).toBe("");
    expect(snap.drafts.map((d) => d.exerciseId)).toEqual(["bench"]);
    expect(snap.drafts[0]!.setTargetLabel).toBeUndefined();
  });

  it("No Day → Day: drops blanks then fills", () => {
    const editor = createEditor({
      workout: workout({ id: "w1", dayId: "", dayNameSnapshot: "" }),
    });
    editor.addExercise("orphan", "Orphan");

    const push = day("day-a", "Push");
    editor.applyDaySelection(push, [
      template({
        id: "t-bench",
        dayId: "day-a",
        exerciseId: "bench",
        exerciseDisplayName: "Bench",
        order: 0,
      }),
    ]);

    const snap = editor.getSnapshot();
    expect(snap.workout.dayId).toBe("day-a");
    expect(snap.drafts.map((d) => d.exerciseId)).toEqual(["bench"]);
    expect(snap.drafts[0]!.setTargetLabel).toBe("3 × 5–8");
  });

  it("keeps blank text drafts that still have setIds", () => {
    const editor = createEditor({
      sets: [
        set({
          id: "s1",
          exerciseId: "bench",
          exerciseNameSnapshot: "Bench",
          order: 0,
        }),
      ],
    });
    const bench = editor.getSnapshot().drafts[0]!;
    // Clear text without flushing — setIds remain.
    editor.setText(bench.localId, "");

    editor.applyDaySelection(day("day-b", "Legs"), [
      template({
        id: "t-squat",
        dayId: "day-b",
        exerciseId: "squat",
        exerciseDisplayName: "Squat",
        order: 0,
      }),
    ]);

    const snap = editor.getSnapshot();
    const ids = snap.drafts.map((d) => d.exerciseId);
    expect(ids).toContain("bench");
    expect(ids).toContain("squat");
    const kept = snap.drafts.find((d) => d.exerciseId === "bench")!;
    expect(kept.setIds).toEqual(["s1"]);
    expect(kept.text).toBe("");
  });

  it("fillFromDay alone does not clear existing blanks", () => {
    const editor = createEditor();
    editor.addExercise("custom", "Face Pulls");
    editor.fillFromDay([
      template({
        id: "t-bench",
        dayId: "day-a",
        exerciseId: "bench",
        exerciseDisplayName: "Bench",
        order: 0,
      }),
    ]);

    const ids = editor.getSnapshot().drafts.map((d) => d.exerciseId);
    expect(ids).toEqual(["custom", "bench"]);
  });
});

describe("reconcile live draft", () => {
  function defer<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it("persists text edited while an earlier reconcile is still queued", async () => {
    const gate = defer<void>();
    const persistence = stubPersistence();
    const reconcileCalls: Array<{ reps: number; weight: number }[]> = [];
    persistence.updateWorkout = vi.fn(() => gate.promise);
    persistence.reconcileExercise = vi.fn(async (input) => {
      reconcileCalls.push(
        input.desiredSets.map((s: { reps: number; weight: number }) => ({
          reps: s.reps,
          weight: s.weight,
        }))
      );
      return { createdIds: [] };
    });

    const editor = createEditor({
      sets: [
        set({
          id: "s1",
          exerciseId: "bench",
          exerciseNameSnapshot: "Bench",
          reps: 5,
          weight: 225,
          order: 0,
        }),
      ],
      persistence,
    });

    // Block the queue so the reconcile stays queued after enqueue.
    void editor.updateMeta({ note: "hold" });

    const localId = editor.getSnapshot().drafts[0]!.localId;
    editor.setText(localId, "225x5");
    const flushPromise = editor.flushDraft(localId);

    await vi.waitFor(() =>
      expect(editor.getSnapshot().queueStatus).toBe("pending")
    );
    expect(reconcileCalls).toHaveLength(0);

    // Mutate draft while reconcile is still queued — run should re-read live text.
    editor.setText(localId, "185x3");
    gate.resolve();
    await flushPromise;

    expect(reconcileCalls.length).toBeGreaterThanOrEqual(1);
    expect(reconcileCalls[0]).toEqual([{ reps: 3, weight: 185 }]);
  });

  it("exposes hasPendingDebounce while a set-entry timer is armed", () => {
    const editor = createEditor({
      sets: [
        set({
          id: "s1",
          exerciseId: "bench",
          exerciseNameSnapshot: "Bench",
          order: 0,
        }),
      ],
    });
    expect(editor.getSnapshot().hasPendingDebounce).toBe(false);
    const localId = editor.getSnapshot().drafts[0]!.localId;
    editor.setText(localId, "230x5");
    expect(editor.getSnapshot().hasPendingDebounce).toBe(true);
    expect(editor.getSnapshot().isBusy).toBe(true);
  });

  it("dispose flushes pending debounce and queued writes instead of dropping them", async () => {
    const gate = defer<void>();
    const persistence = stubPersistence();
    persistence.updateWorkout = vi.fn(() => gate.promise);
    persistence.reconcileExercise = vi.fn(async () => ({ createdIds: [] }));

    const editor = createEditor({
      sets: [
        set({
          id: "s1",
          exerciseId: "bench",
          exerciseNameSnapshot: "Bench",
          reps: 5,
          weight: 225,
          order: 0,
        }),
      ],
      persistence,
    });

    // Block the queue with a meta write, then arm a debounced reconcile.
    void editor.updateMeta({ note: "keep-me" });
    const localId = editor.getSnapshot().drafts[0]!.localId;
    editor.setText(localId, "230x5");
    expect(editor.getSnapshot().hasPendingDebounce).toBe(true);

    editor.dispose();

    expect(editor.getSnapshot().hasPendingDebounce).toBe(false);
    expect(persistence.reconcileExercise).not.toHaveBeenCalled();

    gate.resolve();
    await vi.waitFor(() =>
      expect(persistence.reconcileExercise).toHaveBeenCalled()
    );
    expect(persistence.updateWorkout).toHaveBeenCalledWith({ note: "keep-me" });
    const reconcileInput = (
      persistence.reconcileExercise as ReturnType<typeof vi.fn>
    ).mock.calls[0]![0] as {
      desiredSets: Array<{ reps: number; weight: number }>;
    };
    expect(
      reconcileInput.desiredSets.map((s) => ({
        reps: s.reps,
        weight: s.weight,
      }))
    ).toEqual([{ reps: 5, weight: 230 }]);
  });

  it("discardPendingWrites drops debounced reconciles and queued work", async () => {
    const gate = defer<void>();
    const persistence = stubPersistence();
    persistence.updateWorkout = vi.fn(() => gate.promise);
    persistence.reconcileExercise = vi.fn(async () => ({
      createdIds: ["s-new"],
    }));

    const editor = createEditor({
      sets: [],
      persistence,
    });
    editor.addExercise("bench", "Bench");
    const localId = editor.getSnapshot().drafts[0]!.localId;

    // Block the queue, then arm a debounced reconcile that would create Sets.
    void editor.updateMeta({ note: "discard-me" });
    editor.setText(localId, "225x5");
    expect(editor.getSnapshot().hasPendingDebounce).toBe(true);

    const discardPromise = editor.discardPendingWrites();
    expect(editor.getSnapshot().hasPendingDebounce).toBe(false);

    gate.resolve();
    await discardPromise;

    expect(persistence.reconcileExercise).not.toHaveBeenCalled();
    expect(editor.getSnapshot().queueStatus).toBe("idle");

    // dispose must not resurrect the discarded debounce.
    editor.dispose();
    await Promise.resolve();
    expect(persistence.reconcileExercise).not.toHaveBeenCalled();
  });

  it("discardPendingWrites waits for in-flight reconcile then stays idle", async () => {
    const gate = defer<void>();
    const persistence = stubPersistence();
    persistence.reconcileExercise = vi.fn(async () => {
      await gate.promise;
      return { createdIds: ["s1"] };
    });

    const editor = createEditor({
      sets: [],
      persistence,
      debounceMs: 0,
    });
    editor.addExercise("bench", "Bench");
    const localId = editor.getSnapshot().drafts[0]!.localId;
    editor.setText(localId, "225x5");

    await vi.waitFor(() =>
      expect(persistence.reconcileExercise).toHaveBeenCalled()
    );

    const discardPromise = editor.discardPendingWrites();
    gate.resolve();
    await discardPromise;

    expect(editor.getSnapshot().queueStatus).toBe("idle");
    expect(editor.getSnapshot().drafts[0]!.setIds).toEqual(["s1"]);
  });
});

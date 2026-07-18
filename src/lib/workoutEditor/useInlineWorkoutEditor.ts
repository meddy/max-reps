import { useEffect, useRef, useSyncExternalStore } from "react";
import type {
  Day,
  TemplateWithExerciseName,
  Workout,
  WorkoutSet,
} from "../../types";
import {
  createInlineWorkoutEditor,
  type InlineEditorPersistence,
  type InlineEditorSnapshot,
  type InlineWorkoutEditor,
  INLINE_EDITOR_DEBOUNCE_MS,
} from "./createInlineWorkoutEditor";

function createEditor(options: {
  workout: Workout & { id: string };
  sets: WorkoutSet[];
  persistenceRef: React.MutableRefObject<InlineEditorPersistence>;
  getPerformedAtRef: React.MutableRefObject<() => Date>;
  debounceMs: number;
}): InlineWorkoutEditor {
  return createInlineWorkoutEditor({
    workout: options.workout,
    sets: options.sets,
    persistence: {
      updateWorkout: (patch) =>
        options.persistenceRef.current.updateWorkout(patch),
      reconcileExercise: (input) =>
        options.persistenceRef.current.reconcileExercise(input),
      reorderAllSets: (updates) =>
        options.persistenceRef.current.reorderAllSets(updates),
    },
    getPerformedAt: () => options.getPerformedAtRef.current(),
    debounceMs: options.debounceMs,
  });
}

export function useInlineWorkoutEditor(options: {
  workout: Workout & { id: string };
  sets: WorkoutSet[];
  persistence: InlineEditorPersistence;
  getPerformedAt: () => Date;
  debounceMs?: number;
  resetKey: string;
}): InlineEditorSnapshot & {
  editor: InlineWorkoutEditor;
  setText: (localId: string, text: string) => void;
  flushDraft: (localId: string) => Promise<void>;
  flushAll: () => Promise<void>;
  updateMeta: InlineWorkoutEditor["updateMeta"];
  addExercise: (exerciseId: string, name: string) => void;
  removeExercise: (localId: string) => void;
  reorderExercises: (activeLocalId: string, overLocalId: string) => void;
  fillFromDay: InlineWorkoutEditor["fillFromDay"];
  applyDaySelection: (
    day: Day | null,
    templates: TemplateWithExerciseName[]
  ) => void;
  setSetTargetLabels: InlineWorkoutEditor["setSetTargetLabels"];
  retry: () => void;
  getCurrentSets: () => WorkoutSet[];
} {
  const persistenceRef = useRef(options.persistence);
  persistenceRef.current = options.persistence;
  const getPerformedAtRef = useRef(options.getPerformedAt);
  getPerformedAtRef.current = options.getPerformedAt;
  const debounceMs = options.debounceMs ?? INLINE_EDITOR_DEBOUNCE_MS;

  const editorRef = useRef<InlineWorkoutEditor | null>(null);
  const resetKeyRef = useRef(options.resetKey);
  const versionRef = useRef(0);

  if (editorRef.current == null) {
    editorRef.current = createEditor({
      workout: options.workout,
      sets: options.sets,
      persistenceRef,
      getPerformedAtRef,
      debounceMs,
    });
  } else if (resetKeyRef.current !== options.resetKey) {
    editorRef.current.dispose();
    editorRef.current = createEditor({
      workout: options.workout,
      sets: options.sets,
      persistenceRef,
      getPerformedAtRef,
      debounceMs,
    });
    resetKeyRef.current = options.resetKey;
    versionRef.current += 1;
  }

  const editor = editorRef.current;
  const version = versionRef.current;

  useEffect(() => {
    return () => {
      editorRef.current?.dispose();
    };
  }, []);

  const snapshot = useSyncExternalStore(
    (listener) => editor.subscribe(listener),
    () => editor.getSnapshot(),
    () => editor.getSnapshot()
  );

  // Touch version so reset recreates subscription identity via editor instance.
  void version;

  return {
    ...snapshot,
    editor,
    setText: (localId, text) => editor.setText(localId, text),
    flushDraft: (localId) => editor.flushDraft(localId),
    flushAll: () => editor.flushAll(),
    updateMeta: (patch) => editor.updateMeta(patch),
    addExercise: (exerciseId, name) => editor.addExercise(exerciseId, name),
    removeExercise: (localId) => editor.removeExercise(localId),
    reorderExercises: (a, b) => editor.reorderExercises(a, b),
    fillFromDay: (templates, opts) => editor.fillFromDay(templates, opts),
    applyDaySelection: (day, templates) =>
      editor.applyDaySelection(day, templates),
    setSetTargetLabels: (templates) => editor.setSetTargetLabels(templates),
    retry: () => editor.retry(),
    getCurrentSets: () => editor.getCurrentSets(),
  };
}

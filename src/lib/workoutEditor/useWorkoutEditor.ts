import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createWorkoutSessionStore } from "./createWorkoutSessionStore";
import {
  DEFAULT_DEBOUNCE_MS,
  type UseWorkoutEditorOptions,
  type UseWorkoutEditorResult,
} from "./model";

export type {
  EditorExerciseGroup,
  EditorRowId,
  EditorSetRow,
  UseWorkoutEditorOptions,
  UseWorkoutEditorResult,
  WorkoutEditorPersistence,
} from "./model";

export {
  editorGroupsFromDayTemplates,
  editorGroupsFromWorkoutSets,
  mergeWorkoutGroupsWithDayTemplates,
  type TemplateWithName,
} from "./editorSeedBuilders";

export { DEFAULT_DEBOUNCE_MS };

export function useWorkoutEditor(
  options: UseWorkoutEditorOptions
): UseWorkoutEditorResult {
  const {
    variant,
    workoutId,
    workout,
    initialGroups,
    resetKey,
    persistence,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;

  const workoutRef = useRef(workout);
  workoutRef.current = workout;

  const store = useMemo(
    () =>
      createWorkoutSessionStore({
        variant,
        workoutId,
        persistence,
        debounceMs,
        getWorkout: () => workoutRef.current,
      }),
    [variant, workoutId, persistence, debounceMs]
  );

  useLayoutEffect(() => {
    return () => store.dispose();
  }, [store]);

  const initialGroupsRef = useRef(initialGroups);
  initialGroupsRef.current = initialGroups;

  useLayoutEffect(() => {
    store.applyReset(initialGroupsRef.current);
  }, [resetKey, store]);

  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );

  return useMemo(
    () => ({
      variant: state.variant,
      groups: state.groups,
      isDirty: state.isDirty,
      getRowApi: store.getRowApi.bind(store),
      addExercise: store.addExercise.bind(store),
      appendTemplateGroup: store.appendTemplateGroup.bind(store),
      reorderExerciseGroups: store.reorderExerciseGroups.bind(store),
      setGroups: store.setGroups.bind(store),
      applyLocalMerge: store.applyLocalMerge.bind(store),
      removeExercise: store.removeExercise.bind(store),
      addSet: store.addSet.bind(store),
      removeSet: store.removeSet.bind(store),
      flushAll: store.flushAll.bind(store),
      updateLastPerformed: store.updateLastPerformed.bind(store),
    }),
    [state, store]
  );
}

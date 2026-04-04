import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createWorkoutSessionStore } from "../lib/workoutSession/createWorkoutSessionStore";
import {
  DEFAULT_DEBOUNCE_MS,
  type UseWorkoutEditorOptions,
  type UseWorkoutEditorResult,
} from "../lib/workoutSession/model";

export type {
  EditorExerciseGroup,
  EditorRowId,
  EditorSetRow,
  UseWorkoutEditorOptions,
  UseWorkoutEditorResult,
  WorkoutEditorPersistence,
} from "../lib/workoutSession/model";

export {
  editorGroupsFromDayTemplates,
  editorGroupsFromWorkoutSets,
  type TemplateWithName,
} from "../lib/workoutSession/editorSeedBuilders";

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
      getRowApi: store.getRowApi.bind(store),
      addExercise: store.addExercise.bind(store),
      appendTemplateGroup: store.appendTemplateGroup.bind(store),
      removeExercise: store.removeExercise.bind(store),
      addSet: store.addSet.bind(store),
      removeSet: store.removeSet.bind(store),
      flushAll: store.flushAll.bind(store),
      updateLastPerformed: store.updateLastPerformed.bind(store),
      isDirty: state.isDirty,
    }),
    [state, store]
  );
}

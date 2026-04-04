import { useCallback, useEffect, useState } from "react";
import type { DataAccess } from "../../lib/dataAccess/types";
import type { EditorExerciseGroup } from "../../lib/workoutEditor/model";
import type { Workout } from "../../types";
import {
  fetchWorkoutDetailWorkout,
  resolveWorkoutDetailEditorSeed,
} from "./workoutDetailFlow";

export function useWorkoutDetailModel(
  workoutId: string | undefined,
  dataAccess: DataAccess
) {
  const [workout, setWorkout] = useState<(Workout & { id: string }) | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [isTemplateMode, setIsTemplateMode] = useState(false);
  const [templateModeLoading, setTemplateModeLoading] = useState(false);
  const [editorSeed, setEditorSeed] = useState<{
    resetKey: string;
    groups: EditorExerciseGroup[];
    variant: "workout" | "template";
  } | null>(null);

  useEffect(() => {
    setEditorSeed(null);
    setWorkout(null);
    setLoading(true);
  }, [workoutId]);

  const loadWorkout = useCallback(async () => {
    if (!workoutId) return;
    const w = await fetchWorkoutDetailWorkout(workoutId, dataAccess);
    if (!w) {
      setWorkout(null);
      setLoading(false);
      return;
    }
    setWorkout(w);
    setLoading(false);
  }, [dataAccess, workoutId]);

  /** Deps use `workout?.dayId` only so note/date edits on the same workout do not re-run this fetch and reset the editor. */
  const loadSets = useCallback(async () => {
    if (!workoutId) return;
    const { editorSeed: seed, isTemplateMode } =
      await resolveWorkoutDetailEditorSeed(workoutId, workout, dataAccess, {
        onTemplateLoadingChange: setTemplateModeLoading,
      });
    setEditorSeed(seed);
    setIsTemplateMode(isTemplateMode);
  }, [dataAccess, workoutId, workout?.dayId]);

  useEffect(() => {
    void loadWorkout();
  }, [loadWorkout]);

  useEffect(() => {
    if (workout) void loadSets();
  }, [workout?.id, loadSets]);

  return {
    workout,
    setWorkout,
    loading,
    isTemplateMode,
    templateModeLoading,
    editorSeed,
  };
}

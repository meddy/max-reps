import { useCallback, useEffect, useState } from "react";
import type {
  WorkoutDetailEditorSeed,
  WorkoutSessionApi,
} from "../dataAccess/workoutSessionTypes";
import type { Workout } from "../../types";

export function useWorkoutDetailModel(
  workoutId: string | undefined,
  session: WorkoutSessionApi
) {
  const [workout, setWorkout] = useState<(Workout & { id: string }) | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [isTemplateMode, setIsTemplateMode] = useState(false);
  const [templateModeLoading, setTemplateModeLoading] = useState(false);
  const [editorSeed, setEditorSeed] = useState<WorkoutDetailEditorSeed | null>(
    null
  );

  useEffect(() => {
    setEditorSeed(null);
    setWorkout(null);
    setLoading(true);
    setIsTemplateMode(false);
    setTemplateModeLoading(false);
  }, [workoutId]);

  const loadDetail = useCallback(async () => {
    if (!workoutId) {
      setWorkout(null);
      setEditorSeed(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const {
      workout: w,
      editorSeed: seed,
      isTemplateMode: templateMode,
    } = await session.loadWorkoutDetail(workoutId, {
      onTemplateLoadingChange: setTemplateModeLoading,
    });
    setWorkout(w);
    setEditorSeed(seed);
    setIsTemplateMode(templateMode);
    setLoading(false);
  }, [session, workoutId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  return {
    workout,
    setWorkout,
    loading,
    isTemplateMode,
    templateModeLoading,
    editorSeed,
  };
}

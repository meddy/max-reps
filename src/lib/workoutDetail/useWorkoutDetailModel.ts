import { useCallback, useEffect, useRef, useState } from "react";
import type {
  WorkoutDetailEditorSeed,
  WorkoutDetailApi,
} from "../dataAccess/workoutDetailTypes";
import { useRemoteLoad } from "../../hooks/useRemoteLoad";
import type { Workout } from "../../types";

export function useWorkoutDetailModel(
  workoutId: string | undefined,
  workoutDetail: WorkoutDetailApi
) {
  const [workout, setWorkout] = useState<(Workout & { id: string }) | null>(
    null
  );
  const [isTemplateMode, setIsTemplateMode] = useState(false);
  const [templateModeLoading, setTemplateModeLoading] = useState(false);
  const [editorSeed, setEditorSeed] = useState<WorkoutDetailEditorSeed | null>(
    null
  );
  const workoutRef = useRef(workout);
  workoutRef.current = workout;

  useEffect(() => {
    setEditorSeed(null);
    setWorkout(null);
    setIsTemplateMode(false);
    setTemplateModeLoading(false);
  }, [workoutId]);

  const loadDetail = useCallback(
    async ({
      background,
      isStale,
    }: {
      background: boolean;
      isStale: () => boolean;
      setForegroundLoading: (loading: boolean) => void;
    }) => {
      if (!workoutId) {
        setWorkout(null);
        setEditorSeed(null);
        return;
      }

      const {
        workout: w,
        editorSeed: seed,
        isTemplateMode: templateMode,
      } = await workoutDetail.loadWorkoutDetail(workoutId, {
        onTemplateLoadingChange: (isLoading) => {
          if (isStale() || background) return;
          setTemplateModeLoading(isLoading);
        },
      });
      if (isStale()) return;
      setWorkout(w);
      setEditorSeed(seed);
      setIsTemplateMode(templateMode);
    },
    [workoutDetail, workoutId]
  );

  const { loading, loadError, reload } = useRemoteLoad({
    load: loadDetail,
    deps: [workoutId, workoutDetail],
    refetchOnVisibility: true,
    hasData: () => workoutRef.current != null,
  });

  useEffect(() => {
    if (!loading) {
      setTemplateModeLoading(false);
    }
  }, [loading]);

  return {
    workout,
    setWorkout,
    loading,
    loadError,
    reload,
    isTemplateMode,
    templateModeLoading,
    editorSeed,
  };
}

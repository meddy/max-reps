import { useCallback, useEffect, useState } from "react";
import type { DataAccess } from "../../lib/dataAccess/types";
import {
  editorGroupsFromDayTemplates,
  editorGroupsFromWorkoutSets,
} from "../../lib/workoutEditor/useWorkoutEditor";
import type { EditorExerciseGroup } from "../../lib/workoutEditor/model";
import type { Workout, WorkoutSet } from "../../types";
import {
  rollupLastPerformedMap,
  toTemplateWithNameRows,
} from "./workoutDetailSeed";

type SetWithId = WorkoutSet & { id: string };

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
    const w = await dataAccess.workouts.get(workoutId);
    if (!w) {
      setWorkout(null);
      setLoading(false);
      return;
    }
    setWorkout(w);
    setLoading(false);
  }, [dataAccess, workoutId]);

  const loadSets = useCallback(async () => {
    if (!workoutId) return;
    const list = (await dataAccess.sets.listForWorkout(
      workoutId
    )) as SetWithId[];

    if (list.length > 0) {
      setEditorSeed({
        resetKey: `${workoutId}-workout`,
        variant: "workout",
        groups: editorGroupsFromWorkoutSets(list),
      });
      setIsTemplateMode(false);
      return;
    }

    if (workout?.dayId) {
      setTemplateModeLoading(true);
      const resolved = await dataAccess.templates.listForDayWithExerciseNames(
        workout.dayId
      );
      const withNames = toTemplateWithNameRows(resolved);

      const lastResults = await Promise.all(
        withNames.map(async (t) => {
          const result = await dataAccess.sets.lastPerformedGroupForExercise(
            t.exerciseId,
            workoutId
          );
          return [t.exerciseId, result] as const;
        })
      );
      const last = rollupLastPerformedMap(lastResults);

      setEditorSeed({
        resetKey: `${workoutId}-template`,
        variant: "template",
        groups: editorGroupsFromDayTemplates(withNames, last),
      });
      setIsTemplateMode(true);
      setTemplateModeLoading(false);
      return;
    }

    setEditorSeed({
      resetKey: `${workoutId}-workout-empty`,
      variant: "workout",
      groups: [],
    });
    setIsTemplateMode(false);
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

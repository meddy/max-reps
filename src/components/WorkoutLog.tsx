import { useEffect, useState } from "react";

import { fetchWorkouts } from "../supabase/database";
import { ExerciseMap, WorkoutMap } from "../types";

export interface WorkoutLogProps {
  exerciseMap?: ExerciseMap;
}

export default function WorkoutLog(props: WorkoutLogProps) {
  const { exerciseMap } = props;
  const [offset, setOffset] = useState(0);
  const [workoutMap, setWorkoutMap] = useState<WorkoutMap>();

  useEffect(() => {
    (async () => {
      setWorkoutMap(await fetchWorkouts(offset));
    })();
  }, [offset]);

  if (!(exerciseMap && workoutMap)) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {Array.from(workoutMap.entries()).map(([workoutId, workout]) => (
        <div key={workoutId}>
          <div>{workout.date}</div>
          {Array.from(workout.exerciseMap.entries()).map(
            ([exerciseId, sets]) => (
              <div key={exerciseId}>
                <div>
                  {exerciseMap.get(exerciseId)?.name ?? "Some Exercise"}
                </div>
                <div>
                  {sets.map((set) => (
                    <div key={set.id}>
                      {set.weight}x{set.reps}
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      ))}
    </div>
  );
}

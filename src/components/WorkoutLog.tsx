import { useEffect, useState } from "react";

import { fetchSets, fetchWorkouts } from "../supabase/database";
import { ExerciseMap, SetRow, WorkoutMap } from "../types";

interface WorkoutLogProps {
  exerciseMap?: ExerciseMap;
}

export default function WorkoutLog(props: WorkoutLogProps) {
  const { exerciseMap } = props;
  const [offset, setOffset] = useState(0);
  const [workoutMap, setWorkoutMap] = useState<WorkoutMap>();
  const [sets, setSets] = useState<SetRow[]>([]);

  useEffect(() => {
    (async () => {
      const workoutMap = await fetchWorkouts(offset);
      setWorkoutMap(workoutMap);
      setSets(await fetchSets(workoutMap));
    })();
  }, [offset]);

  if (!(exerciseMap && workoutMap && sets)) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div>2023-01-01</div>
      <div>
        <div>Bench Press</div>
        <div>135</div>
        <div>7,8,9</div>
      </div>
      <div>
        <div>Back Squat</div>
        <div>225</div>
        <div>5,5,5</div>
      </div>
      <div>
        <div>Deadlift</div>
        <div>
          <div>315</div>
          <div>3,3,3</div>
        </div>
      </div>
    </div>
  );
}

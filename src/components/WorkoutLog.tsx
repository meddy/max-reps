import { ExerciseMap, SetMap, WorkoutRow } from "../types";

export interface WorkoutLogProps {
  exerciseMap: ExerciseMap;
  workouts: WorkoutRow[];
  setMap: SetMap;
}

export default function WorkoutLog(props: WorkoutLogProps) {
  const { exerciseMap, workouts, setMap } = props;

  return (
    <div>
      {workouts.map((workout) => (
        <div key={workout.id}>
          <div>{workout.date}</div>
          {setMap[workout.id].map((set) => (
            <div key={set.id}>
              <div>{exerciseMap[set.exercise_id].name}</div>
              <div key={set.id}>
                {set.weight}x{set.reps}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

import { useEffect } from "react";
import { Exercise, HandleResultFunc } from "./types";
import supabase from "./supabase/client";

export interface WorkoutLogProps {
  exercises: Exercise[];
  handleResult: HandleResultFunc;
}

export default function WorkoutLog(props: WorkoutLogProps) {
  const { exercises, handleResult } = props;

  useEffect(() => {
    (async () => {
      // TODO
      const { data, error } = await supabase
        .from("workouts")
        .select()
        .limit(10);
    })();
  }, [exercises]);

  if (!exercises.length) {
    return null;
  }

  console.log(exercises);
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

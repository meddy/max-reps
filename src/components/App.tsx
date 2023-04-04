import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  fetchExerciseMap,
  fetchSetsByWorkouts,
  fetchWorkouts,
  getSession,
} from "../supabase/api";
import supabase from "../supabase/client";
import Message from "./Message";
import SignIn from "./SignIn";
import SignOut from "./SignOut";
import WorkoutLog from "./WorkoutLog";

export default function App() {
  const queryClient = useQueryClient();
  const isFetching = useIsFetching();

  useEffect(() => {
    supabase.auth.onAuthStateChange(() => {
      queryClient.refetchQueries();
    });
  }, []);

  const sessionResult = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    useErrorBoundary: true,
  });

  const hasSession = !!sessionResult?.data?.session;

  const exercisesResult = useQuery({
    queryKey: ["exerciseMap"],
    queryFn: fetchExerciseMap,
    enabled: hasSession,
    useErrorBoundary: true,
  });

  const workoutsResult = useQuery({
    queryKey: ["workouts"],
    queryFn: fetchWorkouts,
    enabled: hasSession,
    useErrorBoundary: true,
  });

  const setsResult = useQuery({
    queryKey: ["setMap"],
    queryFn: fetchSetsByWorkouts,
    enabled: hasSession,
    useErrorBoundary: true,
  });

  if (sessionResult.isLoading) {
    return <Message isLoading />;
  }

  return (
    <>
      {hasSession ? (
        <>
          <SignOut />
          {isFetching && <Message isLoading />}
          {exercisesResult.data && workoutsResult.data && setsResult.data && (
            <WorkoutLog
              exerciseMap={exercisesResult.data}
              workouts={workoutsResult.data}
              setMap={setsResult.data}
            />
          )}
        </>
      ) : (
        <SignIn />
      )}
    </>
  );
}

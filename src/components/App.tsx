import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  fetchExerciseMap,
  fetchSetsByWorkouts,
  fetchWorkouts,
  getSession,
} from "../supabase/api";
import supabase from "../supabase/client";
import generateMockData from "../supabase/generateMockData";
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

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    useErrorBoundary: true,
  });

  const hasSession = !!sessionQuery?.data?.session;
  useEffect(() => {
    const userId = sessionQuery.data?.session?.user.id;
    if (import.meta.env.DEV && userId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).generateMockData = async () => {
        await generateMockData(userId);
        window.location.reload();
      };
    }
  }, [hasSession]);

  const exercisesQuery = useQuery({
    queryKey: ["exerciseMap"],
    queryFn: fetchExerciseMap,
    enabled: hasSession,
    useErrorBoundary: true,
  });

  const workoutsQuery = useQuery({
    queryKey: ["workouts"],
    queryFn: fetchWorkouts,
    enabled: hasSession,
    useErrorBoundary: true,
  });

  const setsQuery = useQuery({
    queryKey: ["setMap"],
    queryFn: fetchSetsByWorkouts,
    enabled: hasSession,
    useErrorBoundary: true,
  });

  if (sessionQuery.isLoading) {
    return <Message isLoading />;
  }

  return (
    <>
      {hasSession ? (
        <>
          <SignOut />
          {isFetching && <Message isLoading />}
          {exercisesQuery.data && workoutsQuery.data && setsQuery.data && (
            <WorkoutLog
              exerciseMap={exercisesQuery.data}
              workouts={workoutsQuery.data}
              setMap={setsQuery.data}
            />
          )}
        </>
      ) : (
        <SignIn />
      )}
    </>
  );
}

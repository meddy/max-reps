import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

import supabase from "../supabase/client";
import { fetchExercises } from "../supabase/database";
import { ExerciseRow } from "../types";
import * as styles from "./App.css";
import SignIn from "./SignIn";
import SignOut from "./SignOut";
import WorkoutLog from "./WorkoutLog";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [exerciseMap, setExerciseMap] = useState<Map<number, ExerciseRow>>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);

      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });
    });
  }, []);

  useEffect(() => {
    if (session) {
      fetchExercises().then((exerciseMap) => setExerciseMap(exerciseMap));
    }
  }, [session]);

  return (
    <ErrorBoundary
      fallbackRender={({ resetErrorBoundary }) => (
        <>
          <div className={styles.error}>Something went wrong.</div>
          <button onClick={resetErrorBoundary}>Refresh</button>
          {session ? <SignOut /> : <SignIn />}
        </>
      )}
      onError={(error) => console.error(error)}
    >
      {session ? (
        <>
          <SignOut />
          <WorkoutLog exerciseMap={exerciseMap} />
        </>
      ) : (
        <SignIn />
      )}
    </ErrorBoundary>
  );
}

import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import supabase from "./supabase/client";
import WorkoutLog from "./WorkoutLog";
import SignIn from "./SignIn";
import SignOut from "./SignOut";
import { Exercise, HandleResultFunc } from "./types";
import * as styles from "./App.css";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleResult: HandleResultFunc = (result, defaultValue) => {
    const { data, error } = result;
    if (error) {
      console.error(error);
      setErrorMessage("Something went wrong. Please try again");
    }

    return data ?? defaultValue;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    if (session) {
      supabase
        .from("exercises")
        .select()
        .then((result) => {
          setExercises(handleResult(result, []));
        });
    }
  }, [session]);

  return (
    <div>
      <div className={styles.error}>{errorMessage}</div>
      {session ? (
        <>
          <SignOut />
          <WorkoutLog exercises={exercises} handleResult={handleResult} />
        </>
      ) : (
        <SignIn handleResult={handleResult} />
      )}
    </div>
  );
}

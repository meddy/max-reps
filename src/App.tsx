import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import supabase from "./supabase/client";
import WorkoutLog from "./WorkoutLog";
import SignIn from "./SignIn";
import SignOut from "./SignOut";
import { Exercise } from "./types";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);

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
        .then(({ data, error }) => {
          if (error) {
            console.error(error);
          } else {
            setExercises(data);
          }
        });
    }
  }, [session]);

  return (
    <div>
      {session ? (
        <>
          <SignOut />
          <WorkoutLog exercises={exercises} />
        </>
      ) : (
        <SignIn />
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import supabase from "./supabaseClient";
import WorkoutLog from "./WorkoutLog";
import SignIn from "./SignIn";
import SignOut from "./SignOut";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  return (
    <div>
      {session ? (
        <>
          <SignOut />
          <WorkoutLog />
        </>
      ) : (
        <SignIn />
      )}
    </div>
  );
}

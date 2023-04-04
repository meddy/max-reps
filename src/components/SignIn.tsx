import clsx from "clsx";
import { FormEvent, useCallback, useState } from "react";

import supabase from "../supabase/client";
import * as styles from "./SignIn.css";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"start" | "loading" | "sent" | "error">(
    "start"
  );

  // useQuery

  const handleLogin = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();

      setState("loading");
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        console.error(error);
        setState("error");
      } else {
        setState("sent");
      }
    },
    [email]
  );

  const stateMap = {
    start: {
      message: "Sign in with a magic link.",
      className: null,
    },
    loading: {
      message: "Sending magic link...",
      className: styles.loading,
    },
    sent: {
      message: "Check your email for a link to sign in.",
      className: null,
    },
    error: {
      message: "Something went wrong. Try again later.",
      className: styles.error,
    },
  } as const;

  const { message, className } = stateMap[state];
  return (
    <div className={styles.container}>
      <div className={clsx(styles.message, className)}>{message}</div>
      {state !== "sent" && (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            className={styles.email}
            required
            disabled={state === "loading"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={(e) => {
              e.preventDefault();

              if (state !== "start") {
                setState("start");
              }
            }}
          />
          <input type="submit" disabled={state === "loading"} value="Send" />
        </form>
      )}
    </div>
  );
}

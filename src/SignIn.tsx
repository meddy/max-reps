import { FormEventHandler, useState } from "react";
import clsx from "clsx";
import supabase from "./supabase/client";
import { HandleResultFunc } from "./types";
import * as styles from "./SignIn.css";

export interface SignInProps {
  handleResult: HandleResultFunc;
}

export default function SignIn(props: SignInProps) {
  const { handleResult } = props;
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"start" | "loading" | "sent">("start");

  const handleLogin: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    setState("loading");
    const result = handleResult(
      await supabase.auth.signInWithOtp({ email }),
      null
    );
    if (result) {
      setState("sent");
    } else {
      setState("start");
    }
  };

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

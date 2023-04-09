import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { sendToken, verifyToken } from "../supabase/api";
import Message from "./Message";
import * as styles from "./SignIn.css";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");

  const sendTokenMutation = useMutation({
    mutationFn: () => sendToken(email),
    useErrorBoundary: true,
  });

  const verifyTokenMutation = useMutation({
    mutationFn: () => verifyToken(email, token),
  });

  return (
    <div className={styles.container}>
      <Message
        isError={sendTokenMutation.isError || verifyTokenMutation.isError}
        isLoading={sendTokenMutation.isLoading || verifyTokenMutation.isLoading}
        text={
          verifyTokenMutation.isLoading
            ? "Verifying..."
            : verifyTokenMutation.isError
            ? "Invalid token."
            : sendTokenMutation.isIdle
            ? "Sign in with a OTP."
            : sendTokenMutation.isLoading
            ? "Sending email.."
            : sendTokenMutation.isSuccess
            ? "Check your email for a OTP."
            : ""
        }
      />
      {sendTokenMutation.isIdle && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendTokenMutation.mutate();
          }}
        >
          <input
            type="email"
            placeholder="Email"
            className={styles.input}
            required
            disabled={sendTokenMutation.isLoading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="submit"
            disabled={sendTokenMutation.isLoading}
            value="Send"
          />
        </form>
      )}
      {sendTokenMutation.isSuccess && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verifyTokenMutation.mutate();
          }}
        >
          <input
            type="text"
            placeholder="Token"
            className={styles.input}
            required
            disabled={verifyTokenMutation.isLoading}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onFocus={(e) => {
              e.preventDefault();

              if (verifyTokenMutation.isError) {
                verifyTokenMutation.reset();
              }
            }}
          />
          <input
            type="submit"
            disabled={verifyTokenMutation.isLoading}
            value="Submit"
          />
        </form>
      )}
    </div>
  );
}

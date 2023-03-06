import { FormEventHandler } from "react";
import { useState } from "react";
import supabase from "./supabaseClient";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    try {
      setErrorMessage("");
      setLoading(true);

      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        throw error;
      }

      setLinkSent(true);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Sign in via magic link</h2>
      {loading && <p>Sending magic link...</p>}
      {linkSent && <p>Check your email for a link to sign in.</p>}
      {errorMessage && <p>{errorMessage}</p>}
      {!(loading || linkSent) && (
        <form onSubmit={handleLogin}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button>Send magic link</button>
        </form>
      )}
    </div>
  );
}

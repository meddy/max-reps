import supabase from "../supabase/client";

export default function SignOut() {
  return (
    <button type="button" onClick={() => supabase.auth.signOut()}>
      Sign Out
    </button>
  );
}

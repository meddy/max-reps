import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { IconGoogle } from "../components/Icons";

export function Login() {
  const { user, loading, error, signIn, clearError, allowedUid } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  useEffect(() => {
    if (user && !loading) {
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, from]);

  useEffect(() => {
    clearError();
  }, [clearError]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-center text-2xl font-semibold text-gray-900">
          Max Reps
        </h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          Workout tracking
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {!allowedUid && (
          <p className="mt-3 text-center text-xs text-amber-600">
            Set VITE_ALLOWED_UID in .env and deploy Firestore rules with your
            UID to restrict access.
          </p>
        )}

        <button
          type="button"
          onClick={() => void signIn()}
          className="mt-6 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <IconGoogle className="size-5" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

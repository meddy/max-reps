import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { BottomNav } from "./BottomNav";

export function Layout() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900">Max Reps</h1>
          {user && (
            <p className="truncate text-xs text-gray-400" title="Your Firebase UID (must match firestore.rules and VITE_ALLOWED_UID)">
              UID: {user.uid}
            </p>
          )}
        </div>
        <Link
          to="/export"
          className="min-h-[44px] flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Export
        </Link>
      </header>
      <main className="flex-1 overflow-auto pb-16">
        <div className="p-4">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

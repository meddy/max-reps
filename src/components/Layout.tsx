import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { BottomNav } from "./BottomNav";

export function Layout() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="px-4 py-3">
          <div className="mx-auto flex max-w-[960px] items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-gray-900">Max Reps</h1>
              {user && (
                <p
                  className="truncate text-xs text-gray-400"
                  title="Your Firebase UID (must match firestore.rules and VITE_ALLOWED_UID)"
                >
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
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto pb-16">
        <div className="p-4">
          <div className="mx-auto max-w-[960px]">
            <Outlet />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

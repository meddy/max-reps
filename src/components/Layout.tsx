import { Outlet, Link } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="px-4 py-3">
          <div className="mx-auto flex max-w-[960px] items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-gray-900">Max Reps</h1>
            </div>
            <Link
              to="/settings"
              className="min-h-[44px] flex min-w-[44px] items-center justify-center text-indigo-600 hover:text-indigo-500"
              aria-label="Settings"
            >
              <svg
                className="size-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
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

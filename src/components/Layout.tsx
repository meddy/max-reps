import { Outlet, Link } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { IconSettings } from "./Icons";

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
              title="Settings"
            >
              <IconSettings className="size-6" />
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

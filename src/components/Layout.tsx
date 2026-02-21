import { useSyncExternalStore } from "react";
import { Outlet, Link } from "react-router-dom";
import { getSnapshot, subscribe } from "../lib/savingStore";
import { BottomNav } from "./BottomNav";
import { IconSettings } from "./Icons";

export function Layout() {
  const isSaving = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="px-4 py-3">
          <div className="mx-auto flex max-w-[960px] items-center justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <h1 className="text-lg font-semibold text-gray-900">Max Reps</h1>
              {isSaving ? (
                <span
                  className="flex items-center gap-1.5 text-sm text-gray-500"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <span
                    className="inline-block size-4 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600"
                    role="status"
                    aria-hidden
                  />
                  Saving
                </span>
              ) : null}
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

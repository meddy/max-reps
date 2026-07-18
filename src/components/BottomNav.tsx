import { NavLink } from "react-router-dom";
import { IconCalendar, IconClock, IconList } from "./Icons";

const navItems = [
  { to: "/workouts", label: "Workouts", icon: "history" },
  { to: "/exercises", label: "Exercises", icon: "list" },
  { to: "/days", label: "Days", icon: "calendar" },
] as const;

const navIcons = {
  history: IconClock,
  list: IconList,
  calendar: IconCalendar,
} as const;

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white"
      role="navigation"
      aria-label="Main"
    >
      <div className="px-4">
        <div className="mx-auto flex max-w-[960px]">
          {navItems.map(({ to, label, icon }) => {
            const IconComponent = navIcons[icon];
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                    isActive
                      ? "text-indigo-600"
                      : "text-gray-500 hover:text-gray-800"
                  }`
                }
              >
                <IconComponent className="size-6" />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

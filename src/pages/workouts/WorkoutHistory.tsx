import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDataAccess } from "../../contexts/DataAccessContext";
import type { Day, WorkoutListItem } from "../../types";
import { EmptyState } from "../../components/EmptyState";
import { IconPlus } from "../../components/Icons";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Modal } from "../../components/Modal";
import { SortToggleButton } from "../../components/SortToggleButton";
import { formatDate } from "../../lib/format";

const PAGE_SIZE = 100;
const SORT_STORAGE_KEY = "max-reps-workout-sort";
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

type DaySummaryItem = {
  exerciseName: string;
  numSets: number;
  repsLower: number;
  repsUpper: number;
};

function getStoredSortOrder(): "asc" | "desc" {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (stored === "asc" || stored === "desc") return stored;
  } catch {
    /* ignore */
  }
  return "desc";
}

function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function WorkoutHistory() {
  const dataAccess = useDataAccess();
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<WorkoutListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() =>
    getStoredSortOrder()
  );
  const [addWorkoutOpen, setAddWorkoutOpen] = useState(false);
  const [workoutDate, setWorkoutDate] = useState(() => getLocalDateString());
  const [daySearch, setDaySearch] = useState("");
  const [dayResults, setDayResults] = useState<Array<Day & { id: string }>>([]);
  const [templatesByDayId, setTemplatesByDayId] = useState<
    Record<string, DaySummaryItem[]>
  >({});
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<(Day & { id: string }) | null>(
    null
  );
  const [creating, setCreating] = useState(false);

  const fetchWorkouts = useCallback(async () => {
    setLoading(true);
    const withCounts = await dataAccess.workouts.listWithStats({
      sort: sortOrder,
      limit: PAGE_SIZE,
    });
    setWorkouts(withCounts);
    setLoading(false);
  }, [dataAccess, sortOrder]);

  useEffect(() => {
    void fetchWorkouts();
  }, [fetchWorkouts]);

  const handleSortChange = (order: "asc" | "desc") => {
    setSortOrder(order);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, order);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!daySearch.trim()) {
      setDayResults([]);
      return;
    }
    let ignore = false;
    const term = daySearch.trim().toLowerCase();
    void dataAccess.days.searchByNamePrefix(term, 20).then((list) => {
      if (ignore) return;
      setDayResults(list);
    });
    return () => {
      ignore = true;
    };
  }, [daySearch]);

  useEffect(() => {
    if (!addWorkoutOpen || dayResults.length === 0) {
      setTemplatesByDayId({});
      setTemplatesLoading(false);
      return;
    }
    let ignore = false;
    setTemplatesByDayId({});
    setTemplatesLoading(true);
    const dayIds = dayResults.map((d) => d.id);
    void dataAccess.templates
      .listForDaysWithExerciseNames(dayIds)
      .then((byDayMap) => {
        if (ignore) return;
        const byDay: Record<string, DaySummaryItem[]> = {};
        for (const [dayId, templates] of byDayMap) {
          byDay[dayId] = templates.map((t) => ({
            exerciseName: t.exerciseDisplayName,
            numSets: t.numSets,
            repsLower: t.repsLower,
            repsUpper: t.repsUpper,
          }));
        }
        setTemplatesByDayId(byDay);
        setTemplatesLoading(false);
      })
      .catch(() => {
        if (!ignore) setTemplatesLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [addWorkoutOpen, dayResults]);

  const openAddWorkoutModal = useCallback(() => {
    setWorkoutDate(getLocalDateString());
    setDaySearch("");
    setDayResults([]);
    setSelectedDay(null);
    setAddWorkoutOpen(true);
  }, []);

  const closeAddWorkoutModal = useCallback(() => {
    setAddWorkoutOpen(false);
    setDaySearch("");
    setDayResults([]);
    setSelectedDay(null);
  }, []);

  const createWorkout = useCallback(async () => {
    if (!selectedDay || !workoutDate) return;
    setCreating(true);
    const date = new Date(workoutDate + "T12:00:00");
    const id = await dataAccess.workouts.create({
      date,
      dayId: selectedDay.id,
      dayNameSnapshot: selectedDay.displayName,
      note: "",
    });
    setCreating(false);
    closeAddWorkoutModal();
    navigate(`/workouts/${id}`);
  }, [dataAccess, selectedDay, workoutDate, navigate, closeAddWorkoutModal]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SortToggleButton
          value={sortOrder}
          onChange={handleSortChange}
          ariaLabel="Sort workouts by date"
          ascLabel="Oldest first"
          descLabel="Newest first"
        />
        <button
          type="button"
          onClick={openAddWorkoutModal}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Add workout"
          title="Add workout"
        >
          <IconPlus className="size-6" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : workouts.length === 0 ? (
        <EmptyState
          title="No workouts yet"
          description="Add a workout to get started."
          action={
            <button
              type="button"
              onClick={openAddWorkoutModal}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add workout
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {workouts.map((w) => (
            <li key={w.id}>
              <Link
                to={`/workouts/${w.id}`}
                className="block min-h-[44px] rounded-xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-100"
              >
                <p className="font-medium text-gray-900">{w.dayNameSnapshot}</p>
                <p className="text-sm text-gray-500">
                  {formatDate(w.date, { weekday: true })}
                </p>
                <p className="text-sm text-gray-500">
                  {w.exerciseCount ?? 0} exercises - {w.setCount ?? 0} sets
                  {w.totalLoad != null &&
                    w.totalLoad > 0 &&
                    ` - ${w.totalLoad.toLocaleString()} lbs`}
                </p>
                {w.note?.trim() && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {w.note.trim()}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={addWorkoutOpen}
        onClose={closeAddWorkoutModal}
        title="Add workout"
      >
        <div className="mt-3">
          <span className="block text-sm text-gray-600">Date</span>
          <input
            type="date"
            value={workoutDate}
            onChange={(e) => setWorkoutDate(e.target.value)}
            style={
              IS_IOS
                ? { width: "calc(100% - 1.5rem)", boxSizing: "border-box" }
                : undefined
            }
            className={`mt-1 min-h-[44px] rounded-xl border border-gray-300 px-3 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500${IS_IOS ? "" : " w-full"}`}
          />
        </div>
        <label className="mt-4 block text-sm text-gray-600">
          Day template
          <input
            type="search"
            placeholder="Search days..."
            value={daySearch}
            onChange={(e) => setDaySearch(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <ul className="mt-2 flex max-h-48 flex-col gap-2 overflow-auto">
          {dayResults.map((day) => {
            const summaries = templatesByDayId[day.id] ?? [];
            const isLoading = templatesLoading && summaries.length === 0;
            return (
              <li key={day.id}>
                <button
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`w-full rounded-xl px-4 py-3 text-left shadow-sm ${
                    selectedDay?.id === day.id
                      ? "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300"
                      : "bg-white text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <p className="font-medium text-gray-900">{day.displayName}</p>
                  {isLoading ? (
                    <p className="mt-1 text-sm text-gray-400">Loading…</p>
                  ) : summaries.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {summaries.map((s, i) => (
                        <li key={i} className="text-sm text-gray-500">
                          {s.exerciseName} — {s.numSets} × {s.repsLower}–
                          {s.repsUpper} reps
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">No exercises</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {daySearch.trim() && dayResults.length === 0 && (
          <p className="mt-2 text-sm text-gray-500">
            No days match. Create a day from the Days tab.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={closeAddWorkoutModal}
            className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!workoutDate || !selectedDay || creating}
            onClick={() => void createWorkout()}
            className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

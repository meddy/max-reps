import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDataAccess } from "../../contexts/DataAccessContext";
import type { Day, Workout } from "../../types";
import { EmptyState } from "../../components/EmptyState";
import { IconPlus } from "../../components/Icons";
import { LoadErrorPanel } from "../../components/LoadErrorPanel";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Modal } from "../../components/Modal";
import { SortToggleButton } from "../../components/SortToggleButton";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useRemoteLoad } from "../../hooks/useRemoteLoad";
import { formatDate } from "../../lib/format";

const PAGE_SIZE = 25;
const DAY_SEARCH_DEBOUNCE_MS = 300;
const SORT_STORAGE_KEY = "max-reps-workout-sort";
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

type DaySummaryItem = {
  exerciseName: string;
  numSets: number;
  repsLower: number;
  repsUpper: number;
};

type WorkoutRow = Workout & { id: string };
type WorkoutCursor = { date: Date; id: string };
type CreationMode = "fromDay" | "custom";

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

function toCursor(w: WorkoutRow): WorkoutCursor {
  return { date: w.date, id: w.id };
}

export function WorkoutHistory() {
  const dataAccess = useDataAccess();
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef<WorkoutCursor | null>(null);
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
  const [creationMode, setCreationMode] = useState<CreationMode>("fromDay");
  const [customWorkoutName, setCustomWorkoutName] = useState("");
  const [creating, setCreating] = useState(false);
  const [daySearchLoading, setDaySearchLoading] = useState(false);
  const debouncedDaySearch = useDebouncedValue(
    daySearch,
    DAY_SEARCH_DEBOUNCE_MS
  );
  const isDebouncingDaySearch =
    daySearch.trim() !== "" &&
    daySearch.trim().toLowerCase() !== debouncedDaySearch.trim().toLowerCase();

  const fetchWorkouts = useCallback(
    async ({
      isStale,
      setForegroundLoading,
    }: {
      isStale: () => boolean;
      setForegroundLoading: (loading: boolean) => void;
    }) => {
      const recent = await dataAccess.workouts.listRecent({
        sort: sortOrder,
        limit: PAGE_SIZE,
      });
      if (isStale()) return;

      setWorkouts(recent);
      setHasMore(recent.length === PAGE_SIZE);
      cursorRef.current =
        recent.length > 0 ? toCursor(recent[recent.length - 1]!) : null;
      setForegroundLoading(false);
    },
    [dataAccess, sortOrder]
  );

  const {
    loading,
    loadError,
    reload: reloadWorkouts,
  } = useRemoteLoad({
    load: fetchWorkouts,
    deps: [sortOrder],
  });

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (!cursor || !hasMore || loadingMore || loading) return;

    setLoadingMore(true);
    try {
      const recent = await dataAccess.workouts.listRecent({
        sort: sortOrder,
        limit: PAGE_SIZE,
        startAfter: cursor,
      });
      if (recent.length === 0) {
        setHasMore(false);
        return;
      }

      setWorkouts((prev) => [...prev, ...recent]);

      cursorRef.current = toCursor(recent[recent.length - 1]!);
      setHasMore(recent.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [dataAccess, sortOrder, hasMore, loadingMore, loading]);

  const handleSortChange = (order: "asc" | "desc") => {
    cursorRef.current = null;
    setHasMore(false);
    setWorkouts([]);
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
      setDaySearchLoading(false);
    }
  }, [daySearch]);

  useEffect(() => {
    if (!addWorkoutOpen) {
      setDaySearchLoading(false);
      return;
    }
    if (!daySearch.trim()) return;

    const term = debouncedDaySearch.trim().toLowerCase();
    if (!term) return;

    let ignore = false;
    setDaySearchLoading(true);
    void dataAccess.days
      .searchByNamePrefix(term, 20)
      .then((list) => {
        if (ignore) return;
        setDayResults(list);
      })
      .finally(() => {
        if (!ignore) setDaySearchLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [addWorkoutOpen, daySearch, debouncedDaySearch, dataAccess]);

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
    setCreationMode("fromDay");
    setCustomWorkoutName("");
    setAddWorkoutOpen(true);
  }, []);

  const closeAddWorkoutModal = useCallback(() => {
    setAddWorkoutOpen(false);
    setDaySearch("");
    setDayResults([]);
    setSelectedDay(null);
    setCreationMode("fromDay");
    setCustomWorkoutName("");
  }, []);

  const handleCreationModeChange = useCallback((mode: CreationMode) => {
    setCreationMode(mode);
    setSelectedDay(null);
    setCustomWorkoutName("");
    setDaySearch("");
    setDayResults([]);
  }, []);

  const canCreateWorkout =
    Boolean(workoutDate) &&
    (creationMode === "fromDay"
      ? Boolean(selectedDay)
      : Boolean(customWorkoutName.trim()));

  const createWorkout = useCallback(async () => {
    if (!workoutDate || !canCreateWorkout) return;
    setCreating(true);
    const date = new Date(workoutDate + "T12:00:00");
    const payload =
      creationMode === "fromDay"
        ? {
            date,
            dayId: selectedDay!.id,
            dayNameSnapshot: selectedDay!.displayName,
            note: "",
          }
        : {
            date,
            dayId: "",
            dayNameSnapshot: customWorkoutName.trim(),
            note: "",
          };
    const id = await dataAccess.workouts.create(payload);
    setCreating(false);
    closeAddWorkoutModal();
    navigate(`/workouts/${id}`);
  }, [
    dataAccess,
    selectedDay,
    workoutDate,
    creationMode,
    customWorkoutName,
    canCreateWorkout,
    navigate,
    closeAddWorkoutModal,
  ]);

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
      ) : loadError ? (
        <LoadErrorPanel
          title="Could not load workouts."
          message={loadError}
          onRetry={() => void reloadWorkouts()}
        />
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
        <>
          <ul className="flex flex-col gap-2">
            {workouts.map((w) => (
              <li key={w.id}>
                <Link
                  to={`/workouts/${w.id}`}
                  className="block min-h-[44px] rounded-xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-100"
                >
                  <p className="font-medium text-gray-900">
                    {w.dayNameSnapshot}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatDate(w.date, { weekday: true })}
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
          {hasMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore || loading}
              className="min-h-[44px] w-full rounded-xl border border-indigo-200 bg-white text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
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
        <div
          className="mt-4 flex gap-2"
          role="group"
          aria-label="Workout creation mode"
        >
          <button
            type="button"
            onClick={() => handleCreationModeChange("fromDay")}
            className={`min-h-[44px] flex-1 rounded-xl text-sm font-medium transition-colors ${
              creationMode === "fromDay"
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-200"
            }`}
          >
            From Day
          </button>
          <button
            type="button"
            onClick={() => handleCreationModeChange("custom")}
            className={`min-h-[44px] flex-1 rounded-xl text-sm font-medium transition-colors ${
              creationMode === "custom"
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-200"
            }`}
          >
            Custom Workout
          </button>
        </div>
        {creationMode === "fromDay" ? (
          <>
            <label className="mt-4 block text-sm text-gray-600">
              Day
              <input
                type="search"
                placeholder="Search Days..."
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
                      <p className="font-medium text-gray-900">
                        {day.displayName}
                      </p>
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
                        <p className="mt-1 text-sm text-gray-500">
                          No exercises
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {daySearch.trim() &&
              dayResults.length === 0 &&
              !isDebouncingDaySearch &&
              !daySearchLoading && (
                <p className="mt-2 text-sm text-gray-500">
                  No Days match. Create a Day from the Days tab.
                </p>
              )}
          </>
        ) : (
          <label className="mt-4 block text-sm text-gray-600">
            Workout name
            <input
              type="text"
              placeholder="e.g. Hotel gym, Recovery"
              value={customWorkoutName}
              onChange={(e) => setCustomWorkoutName(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
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
            disabled={!canCreateWorkout || creating}
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

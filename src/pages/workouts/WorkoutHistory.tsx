import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  setDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import {
  getCollectionRef,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "../../lib/firestore";
import { db } from "../../lib/firebase";
import type { Day, Workout } from "../../types";
import { EmptyState } from "../../components/EmptyState";
import { IconPlus } from "../../components/Icons";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Modal } from "../../components/Modal";
import { SortToggleButton } from "../../components/SortToggleButton";
import { formatDate } from "../../lib/format";

const PAGE_SIZE = 100;
const SORT_STORAGE_KEY = "max-reps-workout-sort";

function getStoredSortOrder(): "asc" | "desc" {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (stored === "asc" || stored === "desc") return stored;
  } catch {
    /* ignore */
  }
  return "desc";
}

export function WorkoutHistory() {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<
    Array<Workout & { id: string; setCount?: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() =>
    getStoredSortOrder()
  );
  const [addWorkoutOpen, setAddWorkoutOpen] = useState(false);
  const [workoutDate, setWorkoutDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [daySearch, setDaySearch] = useState("");
  const [dayResults, setDayResults] = useState<Array<Day & { id: string }>>([]);
  const [selectedDay, setSelectedDay] = useState<(Day & { id: string }) | null>(
    null
  );
  const [creating, setCreating] = useState(false);

  const fetchWorkouts = useCallback(async () => {
    setLoading(true);
    const ref = getCollectionRef("workouts");
    const q = query(ref, orderBy("date", sortOrder), limit(PAGE_SIZE));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Array<Workout & { id: string }>;
    const withCounts = await Promise.all(
      list.map(async (w) => {
        const setsSnap = await getDocs(
          query(getCollectionRef("sets"), where("workoutId", "==", w.id))
        );
        return { ...w, setCount: setsSnap.size };
      })
    );
    setWorkouts(withCounts);
    setLoading(false);
  }, [sortOrder]);

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
    const ref = getCollectionRef("days");
    const q = query(
      ref,
      where("nameLower", ">=", term),
      where("nameLower", "<=", term + "\uf8ff"),
      orderBy("nameLower"),
      limit(20)
    );
    getDocs(q).then((snap) => {
      if (ignore) return;
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Array<Day & { id: string }>;
      setDayResults(list);
    });
    return () => {
      ignore = true;
    };
  }, [daySearch]);

  const openAddWorkoutModal = useCallback(() => {
    setWorkoutDate(new Date().toISOString().slice(0, 10));
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
    const workoutRef = doc(collection(db, "workouts"));
    const id = workoutRef.id;
    await setDoc(workoutRef, {
      date: Timestamp.fromDate(date),
      dayId: selectedDay.id,
      dayNameSnapshot: selectedDay.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setCreating(false);
    closeAddWorkoutModal();
    navigate(`/workouts/${id}`);
  }, [selectedDay, workoutDate, navigate, closeAddWorkoutModal]);

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
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
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
                className="block min-h-[44px] rounded-xl bg-white p-4 shadow-sm"
              >
                <p className="font-medium text-gray-900">
                  {formatDate(w.date, { weekday: true })} — {w.dayNameSnapshot}
                </p>
                <p className="text-sm text-gray-500">{w.setCount ?? 0} sets</p>
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
        <label className="mt-3 block text-sm text-gray-600">
          Date
          <input
            type="date"
            value={workoutDate}
            onChange={(e) => setWorkoutDate(e.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-xl border border-gray-300 px-3 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
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
          {dayResults.map((day) => (
            <li key={day.id}>
              <button
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`min-h-[44px] w-full rounded-xl px-4 text-left font-medium shadow-sm ${
                  selectedDay?.id === day.id
                    ? "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300"
                    : "bg-white text-gray-900 hover:bg-gray-50"
                }`}
              >
                {day.displayName}
              </button>
            </li>
          ))}
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
            className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

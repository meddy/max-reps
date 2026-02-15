import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCollectionRef,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "../../lib/firestore";
import type { Workout } from "../../types";
import { EmptyState } from "../../components/EmptyState";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import type { Timestamp } from "firebase/firestore";

const PAGE_SIZE = 100;

function formatDate(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function WorkoutHistory() {
  const [workouts, setWorkouts] = useState<
    Array<Workout & { id: string; setCount?: number }>
  >([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkouts = useCallback(async () => {
    setLoading(true);
    const ref = getCollectionRef("workouts");
    const q = query(ref, orderBy("date", "desc"), limit(PAGE_SIZE));
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
  }, []);

  useEffect(() => {
    void fetchWorkouts();
  }, [fetchWorkouts]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (workouts.length === 0) {
    return (
      <EmptyState
        title="No workouts yet"
        description="Create a workout from the Workout tab."
        action={
          <Link
            to="/workouts/new"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Create workout
          </Link>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {workouts.map((w) => (
        <li key={w.id}>
          <Link
            to={`/workouts/${w.id}`}
            className="block min-h-[44px] rounded-xl bg-white p-4 shadow-sm"
          >
            <p className="font-medium text-gray-900">
              {formatDate(w.date)} — {w.dayNameSnapshot}
            </p>
            <p className="text-sm text-gray-500">
              {w.setCount ?? 0} sets
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

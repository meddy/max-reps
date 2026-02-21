import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getDocRef,
  getCollectionRef,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "../../lib/firestore";
import type { Exercise, Workout, WorkoutSet } from "../../types";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { formatDate } from "../../lib/format";

export function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<(Exercise & { id: string }) | null>(
    null
  );
  const [sets, setSets] = useState<Array<WorkoutSet & { id: string }>>([]);
  const [workoutNotesByWorkoutId, setWorkoutNotesByWorkoutId] = useState<
    Record<string, string>
  >({});
  const [prSet, setPrSet] = useState<(WorkoutSet & { id: string }) | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const docSnap = await getDoc(getDocRef("exercises", id));
    if (!docSnap.exists()) {
      setExercise(null);
      setLoading(false);
      return;
    }
    setExercise({ id: docSnap.id, ...docSnap.data() } as Exercise & {
      id: string;
    });

    const setsRef = query(
      getCollectionRef("sets"),
      where("exerciseId", "==", id),
      orderBy("performedAt", "desc"),
      limit(100)
    );
    const prRef = query(
      getCollectionRef("sets"),
      where("exerciseId", "==", id),
      orderBy("weight", "desc"),
      limit(1)
    );
    const [setsSnap, prSnap] = await Promise.all([
      getDocs(setsRef),
      getDocs(prRef),
    ]);
    const setsList = setsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Array<WorkoutSet & { id: string }>;
    setSets(setsList);

    const workoutIds = [...new Set(setsList.map((s) => s.workoutId))];
    const workoutSnaps = await Promise.all(
      workoutIds.map((wid) => getDoc(getDocRef("workouts", wid)))
    );
    const notes: Record<string, string> = {};
    for (let i = 0; i < workoutIds.length; i++) {
      const snap = workoutSnaps[i];
      if (snap?.exists()) {
        const note = (snap.data() as Workout).note;
        if (note) notes[workoutIds[i]] = note;
      }
    }
    setWorkoutNotesByWorkoutId(notes);

    if (!prSnap.empty) {
      const d = prSnap.docs[0];
      setPrSet({ id: d.id, ...d.data() } as WorkoutSet & { id: string });
    } else {
      setPrSet(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const setNumberBySetId = useMemo(() => {
    const byWorkout = new Map<string, Array<WorkoutSet & { id: string }>>();
    for (const s of sets) {
      const list = byWorkout.get(s.workoutId) ?? [];
      list.push(s);
      byWorkout.set(s.workoutId, list);
    }
    const result = new Map<string, number>();
    for (const workoutSets of byWorkout.values()) {
      const sorted = [...workoutSets].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
      sorted.forEach((s, i) => result.set(s.id, i + 1));
    }
    return result;
  }, [sets]);

  const sortedSets = useMemo(() => {
    return [...sets].sort((a, b) => {
      const aTime = a.performedAt?.toMillis?.() ?? 0;
      const bTime = b.performedAt?.toMillis?.() ?? 0;
      if (bTime !== aTime) return bTime - aTime;
      const aNum = setNumberBySetId.get(a.id) ?? 0;
      const bNum = setNumberBySetId.get(b.id) ?? 0;
      return aNum - bNum;
    });
  }, [sets, setNumberBySetId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div>
        <p className="text-gray-500">Exercise not found.</p>
        <button
          type="button"
          onClick={() => navigate("/exercises")}
          className="mt-2 text-indigo-600 hover:underline"
        >
          Back to exercises
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">
          {exercise.displayName}
        </h2>
        <button
          type="button"
          onClick={() => navigate("/exercises")}
          className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Exercises
        </button>
      </div>

      {prSet && (
        <div className="rounded-xl bg-indigo-50 p-4">
          <p className="text-sm font-medium text-indigo-800">Personal record</p>
          <p className="text-lg font-semibold text-indigo-900">
            {prSet.reps} × {prSet.weight} {prSet.unit}
          </p>
          {prSet.note && (
            <p className="mt-1 text-sm text-indigo-700">{prSet.note}</p>
          )}
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm">
        <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-500">
          Set history
        </h3>
        {sets.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No sets recorded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sortedSets.map((s) => (
              <li
                key={s.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer px-4 py-3 transition-colors hover:bg-gray-50 active:bg-gray-100"
                onClick={() => navigate(`/workouts/${s.workoutId}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/workouts/${s.workoutId}`);
                  }
                }}
              >
                <div className="flex justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="font-medium text-gray-900">
                      {s.reps} × {s.weight} {s.unit}
                    </span>
                    <span className="min-w-0 truncate text-sm text-gray-500">
                      ·{" "}
                      {[
                        `Set ${setNumberBySetId.get(s.id) ?? 1}`,
                        workoutNotesByWorkoutId[s.workoutId],
                        s.note || undefined,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm text-gray-500">
                    {formatDate(s.performedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

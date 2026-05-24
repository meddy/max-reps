import { useCallback, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDataAccess } from "../../contexts/DataAccessContext";
import type { Exercise, WorkoutSet } from "../../types";
import { LoadErrorPanel } from "../../components/LoadErrorPanel";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useRemoteLoad } from "../../hooks/useRemoteLoad";
import { TopSetChart } from "../../components/TopSetChart";
import { formatDateShort } from "../../lib/format";
import {
  buildSetNumberBySetId,
  buildSortedSetsForHistory,
  buildTopSetsPerWorkoutChartSeries,
} from "../../lib/exerciseDetailViewModel";

type SetWithId = WorkoutSet & { id: string };

export function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dataAccess = useDataAccess();
  const [exercise, setExercise] = useState<(Exercise & { id: string }) | null>(
    null
  );
  const [sets, setSets] = useState<SetWithId[]>([]);
  const [workoutNotesByWorkoutId, setWorkoutNotesByWorkoutId] = useState<
    Record<string, string>
  >({});
  const [prSet, setPrSet] = useState<SetWithId | null>(null);
  const load = useCallback(
    async ({ isStale }: { isStale: () => boolean }) => {
      if (!id) return;
      const ex = await dataAccess.exercises.get(id);
      if (isStale()) return;
      if (!ex) {
        setExercise(null);
        setSets([]);
        setPrSet(null);
        setWorkoutNotesByWorkoutId({});
        return;
      }
      setExercise(ex as Exercise & { id: string });

      const [setsList, pr] = await Promise.all([
        dataAccess.sets.listForExercise(id, { limit: 100 }),
        dataAccess.sets.prForExercise(id),
      ]);
      if (isStale()) return;
      setSets(setsList);
      setPrSet(pr);

      const workoutIds = [...new Set(setsList.map((s) => s.workoutId))];
      const notes = await dataAccess.workouts.getNotesByWorkoutIds(workoutIds);
      if (isStale()) return;
      setWorkoutNotesByWorkoutId(notes);
    },
    [dataAccess, id]
  );

  const { loading, loadError, reload } = useRemoteLoad({
    load,
    deps: [id],
  });

  const setNumberBySetId = useMemo(() => buildSetNumberBySetId(sets), [sets]);

  const sortedSets = useMemo(
    () => buildSortedSetsForHistory(sets, setNumberBySetId),
    [sets, setNumberBySetId]
  );

  const topSetsPerWorkout = useMemo(
    () => buildTopSetsPerWorkoutChartSeries(sets),
    [sets]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <LoadErrorPanel
          title="Could not load exercise."
          message={loadError}
          onRetry={() => void reload()}
        />
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
          className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Back to Exercises
        </button>
      </div>

      {prSet && (
        <div className="rounded-xl bg-indigo-50 p-4">
          <p className="text-sm font-medium text-indigo-800">Personal record</p>
          <p className="text-lg font-semibold text-indigo-900">
            {prSet.weight} × {prSet.reps} lbs
          </p>
          {prSet.note && (
            <p className="mt-1 text-sm text-indigo-700">{prSet.note}</p>
          )}
        </div>
      )}

      {topSetsPerWorkout.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-gray-500">
            Top set per workout
          </h3>
          <TopSetChart data={topSetsPerWorkout} />
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm">
        <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-500">
          Set history
        </h3>
        {sets.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No sets recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-12" />
                <col className="w-[6.5rem]" />
                <col />
                <col className="w-[7.5rem]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-500">
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    Set #
                  </th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">
                    Wt (lbs) × Reps
                  </th>
                  <th
                    scope="col"
                    className="min-w-0 px-2 py-2 text-left font-medium"
                  >
                    Notes
                  </th>
                  <th
                    scope="col"
                    className="pl-4 pr-6 py-2 text-left font-medium"
                  >
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedSets.map((s) => {
                  const notesText = [
                    workoutNotesByWorkoutId[s.workoutId],
                    s.note || undefined,
                  ]
                    .filter(Boolean)
                    .join(" / ");
                  return (
                    <tr
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none active:bg-gray-200"
                      onClick={() => navigate(`/workouts/${s.workoutId}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/workouts/${s.workoutId}`);
                        }
                      }}
                    >
                      <td className="px-4 py-3 text-left tabular-nums text-gray-900">
                        {setNumberBySetId.get(s.id) ?? 1}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-left font-medium text-gray-900">
                        {s.weight} × {s.reps}
                      </td>
                      <td className="max-w-0 min-w-0 px-2 py-3 text-left text-gray-500">
                        <span
                          className="block truncate"
                          title={notesText || undefined}
                        >
                          {notesText}
                        </span>
                      </td>
                      <td className="whitespace-nowrap pl-4 pr-6 py-3 text-left tabular-nums text-gray-500">
                        {formatDateShort(s.performedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import type { TopSetChartPoint } from "../components/TopSetChart";
import type { WorkoutSet } from "../types";

type SetWithId = WorkoutSet & { id: string };

export function buildSetNumberBySetId(sets: SetWithId[]): Map<string, number> {
  const byWorkout = new Map<string, SetWithId[]>();
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
}

export function buildSortedSetsForHistory(
  sets: SetWithId[],
  setNumberBySetId: Map<string, number>
): SetWithId[] {
  return [...sets].sort((a, b) => {
    const aTime = a.performedAt.getTime();
    const bTime = b.performedAt.getTime();
    if (bTime !== aTime) return bTime - aTime;
    const aNum = setNumberBySetId.get(a.id) ?? 0;
    const bNum = setNumberBySetId.get(b.id) ?? 0;
    return aNum - bNum;
  });
}

export function buildTopSetsPerWorkoutChartSeries(
  sets: SetWithId[]
): TopSetChartPoint[] {
  const byWorkout = new Map<string, SetWithId>();
  for (const s of sets) {
    const existing = byWorkout.get(s.workoutId);
    const isBetter =
      !existing ||
      s.weight > existing.weight ||
      (s.weight === existing.weight && s.reps > existing.reps);
    if (isBetter) {
      byWorkout.set(s.workoutId, s);
    }
  }
  const values = [...byWorkout.values()];
  values.sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
  return values.map((s) => {
    const date = s.performedAt;
    return {
      dateMs: date.getTime(),
      dateLabel: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      weight: s.weight,
      reps: s.reps,
      label: `${s.weight}×${s.reps}`,
    };
  });
}

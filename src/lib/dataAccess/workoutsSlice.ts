import type { Workout, WorkoutListItem, WorkoutSet } from "../../types";
import type { WorkoutsSliceFirestorePort } from "../firestoreDataPort/types";
import {
  mapWorkoutFromDoc,
  mapWorkoutSetFromDoc,
} from "../firestoreModelMappers";
import { DEFAULT_PAGE } from "./constants";
import { removeWithCascade } from "./removeWithCascade";
import type { DataAccessDeps } from "./types";
import { withSaving } from "./withSaving";

export function buildWorkoutsSlice(
  firestore: WorkoutsSliceFirestorePort,
  saving: DataAccessDeps["saving"]
) {
  return {
    async get(id: string): Promise<(Workout & { id: string }) | null> {
      const raw = await firestore.getDocument("workouts", id);
      if (!raw) return null;
      return mapWorkoutFromDoc(raw.id, raw.data);
    },

    async previousForDayBefore(dayId: string, beforeDate: Date) {
      const rows = await firestore.queryWorkoutsByDayBeforeDate(
        dayId,
        beforeDate,
        1
      );
      if (rows.length === 0) return null;
      const first = rows[0];
      return mapWorkoutFromDoc(first.id, first.data);
    },

    async getWithSets(id: string): Promise<{
      workout: Workout & { id: string };
      sets: WorkoutSet[];
    } | null> {
      const raw = await firestore.getDocument("workouts", id);
      if (!raw) return null;
      const workout = mapWorkoutFromDoc(raw.id, raw.data);
      const setRows = await firestore.querySetsForWorkoutOrdered(id);
      const sets = setRows.map((d) => mapWorkoutSetFromDoc(d.id, d.data));
      return { workout, sets };
    },

    async create(input: {
      date: Date;
      dayId: string;
      dayNameSnapshot: string;
      note?: string;
    }): Promise<string> {
      return withSaving(saving, () =>
        firestore.addDocument("workouts", {
          ...input,
          note: input.note ?? "",
        } as Record<string, unknown>)
      );
    },

    async update(
      id: string,
      patch: Partial<
        Pick<Workout, "date" | "dayId" | "dayNameSnapshot" | "note">
      >
    ): Promise<void> {
      return withSaving(saving, async () => {
        const { date, ...rest } = patch;
        const restPatch = Object.fromEntries(
          Object.entries(rest).filter(([, v]) => v !== undefined)
        ) as Record<string, unknown>;
        if (date !== undefined) {
          await firestore.syncWorkoutDateAndSetsPerformedAt(id, date);
        }
        if (Object.keys(restPatch).length > 0) {
          await firestore.patchDocument("workouts", id, restPatch);
        }
      });
    },

    async deleteWithSets(id: string): Promise<void> {
      return withSaving(saving, () =>
        removeWithCascade(firestore, "workout", id)
      );
    },

    async getNotesByWorkoutIds(ids: string[]): Promise<Record<string, string>> {
      const notes: Record<string, string> = {};
      await Promise.all(
        ids.map(async (wid) => {
          const raw = await firestore.getDocument("workouts", wid);
          if (raw) {
            const note = raw.data.note as string | undefined;
            if (note) notes[wid] = note;
          }
        })
      );
      return notes;
    },

    async listWithStats(opts: {
      sort: "asc" | "desc";
      limit?: number;
    }): Promise<WorkoutListItem[]> {
      const lim = opts.limit ?? DEFAULT_PAGE;
      const workoutRows = await firestore.queryWorkoutsByDate({
        sort: opts.sort,
        limit: lim,
      });
      const list = workoutRows.map((d) => mapWorkoutFromDoc(d.id, d.data));
      const withCounts = await Promise.all(
        list.map(async (w) => {
          const setRows = await firestore.querySetsByWorkoutId(w.id);
          const exerciseIds = new Set<string>();
          let totalLoad = 0;
          for (const d of setRows) {
            const data = d.data;
            exerciseIds.add(data.exerciseId as string);
            totalLoad +=
              ((data.reps as number) ?? 0) * ((data.weight as number) ?? 0);
          }
          return {
            ...w,
            setCount: setRows.length,
            exerciseCount: exerciseIds.size,
            totalLoad,
          } as WorkoutListItem;
        })
      );
      return withCounts;
    },
  };
}

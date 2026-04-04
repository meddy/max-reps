import type { CascadeSpec } from "../firestoreDataPort/types";

/** Cascades when deleting a day (templates scoped by dayId). */
export const cascadesForDayDelete: CascadeSpec[] = [
  { collection: "exerciseSetTemplates", field: "dayId" },
];

/** Cascades when deleting a workout (sets scoped by workoutId). */
export const cascadesForWorkoutDelete: CascadeSpec[] = [
  { collection: "sets", field: "workoutId" },
];

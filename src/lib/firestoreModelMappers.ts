import type {
  Day,
  Exercise,
  ExerciseSetTemplate,
  Workout,
  WorkoutSet,
} from "../types";
import { readTimestampAsDate } from "./firestoreDocSerialize";

export function mapExerciseFromDoc(
  id: string,
  data: Record<string, unknown>
): Exercise & { id: string } {
  return {
    id,
    nameLower: data.nameLower as string,
    displayName: data.displayName as string,
    createdAt: readTimestampAsDate(data.createdAt),
    updatedAt: readTimestampAsDate(data.updatedAt),
  };
}

export function mapDayFromDoc(
  id: string,
  data: Record<string, unknown>
): Day & { id: string } {
  return {
    id,
    nameLower: data.nameLower as string,
    displayName: data.displayName as string,
    createdAt: readTimestampAsDate(data.createdAt),
    updatedAt: readTimestampAsDate(data.updatedAt),
  };
}

export function mapTemplateFromDoc(
  id: string,
  data: Record<string, unknown>
): ExerciseSetTemplate & { id: string } {
  return {
    id,
    dayId: data.dayId as string,
    exerciseId: data.exerciseId as string,
    numSets: data.numSets as number,
    repsLower: data.repsLower as number,
    repsUpper: data.repsUpper as number,
    order: data.order as number,
    createdAt: readTimestampAsDate(data.createdAt),
    updatedAt: readTimestampAsDate(data.updatedAt),
  };
}

export function mapWorkoutFromDoc(
  id: string,
  data: Record<string, unknown>
): Workout & { id: string } {
  return {
    id,
    date: readTimestampAsDate(data.date),
    dayId: data.dayId as string,
    dayNameSnapshot: data.dayNameSnapshot as string,
    note: data.note as string | undefined,
    createdAt: readTimestampAsDate(data.createdAt),
    updatedAt: readTimestampAsDate(data.updatedAt),
  };
}

export function mapWorkoutSetFromDoc(
  id: string,
  data: Record<string, unknown>
): WorkoutSet & { id: string } {
  return {
    id,
    workoutId: data.workoutId as string,
    exerciseId: data.exerciseId as string,
    exerciseNameSnapshot: data.exerciseNameSnapshot as string,
    reps: data.reps as number,
    weight: data.weight as number,
    unit: data.unit as string,
    note: (data.note as string) ?? "",
    performedAt: readTimestampAsDate(data.performedAt),
    order: data.order as number,
    createdAt: readTimestampAsDate(data.createdAt),
  };
}

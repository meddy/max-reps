import type { Exercise } from "../types";

type SearchableExercise = Exercise & { id: string };

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function tokenize(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function everyTokenMatchesPrefix(
  queryTokens: string[],
  nameTokens: string[]
): boolean {
  return queryTokens.every((queryToken) =>
    nameTokens.some((nameToken) => nameToken.startsWith(queryToken))
  );
}

function rankExercise(
  exercise: SearchableExercise,
  queryLower: string,
  queryTokens: string[]
): number | null {
  const nameLower = normalize(exercise.displayName || exercise.nameLower);
  if (!nameLower) return null;

  if (nameLower === queryLower) return 0;
  if (nameLower.startsWith(queryLower)) return 1;

  const nameTokens = tokenize(nameLower);
  if (
    queryTokens.length > 0 &&
    nameTokens.length > 0 &&
    everyTokenMatchesPrefix(queryTokens, nameTokens)
  ) {
    return 2;
  }

  if (nameLower.includes(queryLower)) return 3;

  return null;
}

export function searchExercises(
  exercises: SearchableExercise[],
  query: string,
  limit = 20
): SearchableExercise[] {
  const queryLower = normalize(query);
  if (!queryLower) return [];

  const queryTokens = tokenize(queryLower);

  return exercises
    .map((exercise) => ({
      exercise,
      score: rankExercise(exercise, queryLower, queryTokens),
    }))
    .filter(
      (entry): entry is { exercise: SearchableExercise; score: number } =>
        entry.score != null
    )
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.exercise.nameLower.localeCompare(b.exercise.nameLower);
    })
    .slice(0, limit)
    .map((entry) => entry.exercise);
}

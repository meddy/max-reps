import { useCallback, useEffect, useState } from "react";
import { useDataAccess } from "../contexts/DataAccessContext";
import { searchExercises } from "../lib/exerciseSearch";
import type { Exercise } from "../types";

export function useExercisePicker(options: { active: boolean }) {
  const dataAccess = useDataAccess();
  const [allExercises, setAllExercises] = useState<
    Array<Exercise & { id: string }>
  >([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Array<Exercise & { id: string }>>([]);
  const [selected, setSelected] = useState<{
    id: string;
    displayName: string;
  } | null>(null);
  const [createExerciseError, setCreateExerciseError] = useState("");

  useEffect(() => {
    if (!options.active) {
      setAllExercises([]);
      setSearch("");
      setResults([]);
      setSelected(null);
      setCreateExerciseError("");
      return;
    }
    let ignore = false;
    void dataAccess.exercises.listAllForSearch().then((list) => {
      if (ignore) return;
      setAllExercises(list);
    });
    return () => {
      ignore = true;
    };
  }, [dataAccess, options.active]);

  useEffect(() => {
    if (!options.active || !search.trim()) {
      setResults([]);
      return;
    }
    setResults(searchExercises(allExercises, search, 20));
  }, [allExercises, options.active, search]);

  const selectExercise = useCallback((ex: Exercise & { id: string }) => {
    setSelected({ id: ex.id, displayName: ex.displayName });
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
    setSearch("");
  }, []);

  const createExerciseFromSearch = useCallback(async () => {
    const displayName = search.trim();
    if (!displayName) return;
    setCreateExerciseError("");
    const nameLower = displayName.toLowerCase();
    const existing = await dataAccess.exercises.findByExactName(nameLower);
    if (existing) {
      setCreateExerciseError("An exercise with this name already exists");
      return;
    }
    const newId = await dataAccess.exercises.create({
      nameLower,
      displayName,
    });
    setAllExercises((prev) => [
      ...prev,
      {
        id: newId,
        nameLower,
        displayName,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    setSelected({ id: newId, displayName });
    setSearch("");
  }, [dataAccess, search]);

  const reset = useCallback(() => {
    setSearch("");
    setResults([]);
    setSelected(null);
    setCreateExerciseError("");
  }, []);

  const hasExactMatch =
    search.trim() !== "" &&
    allExercises.some((ex) => ex.nameLower === search.trim().toLowerCase());

  const showCreatePrompt =
    options.active &&
    search.trim() !== "" &&
    !hasExactMatch &&
    selected == null;

  return {
    search,
    setSearch,
    results,
    selected,
    selectExercise,
    clearSelection,
    createExerciseFromSearch,
    createExerciseError,
    showCreatePrompt,
    reset,
  };
}

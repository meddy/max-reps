import { useCallback, useEffect, useState } from "react";
import { useDataAccess } from "../contexts/DataAccessContext";
import type { Exercise } from "../types";

export function useExercisePicker(options: { active: boolean }) {
  const dataAccess = useDataAccess();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Array<Exercise & { id: string }>>([]);
  const [selected, setSelected] = useState<{
    id: string;
    displayName: string;
  } | null>(null);
  const [createExerciseError, setCreateExerciseError] = useState("");

  useEffect(() => {
    if (!options.active) {
      setSearch("");
      setResults([]);
      setSelected(null);
      setCreateExerciseError("");
    }
  }, [options.active]);

  useEffect(() => {
    if (!options.active || !search.trim()) {
      setResults([]);
      return;
    }
    let ignore = false;
    const term = search.trim().toLowerCase();
    void dataAccess.exercises.searchByNamePrefix(term, 20).then((list) => {
      if (ignore) return;
      setResults(list as Array<Exercise & { id: string }>);
    });
    return () => {
      ignore = true;
    };
  }, [dataAccess, options.active, search]);

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
    setSelected({ id: newId, displayName });
    setSearch("");
  }, [dataAccess, search]);

  const reset = useCallback(() => {
    setSearch("");
    setResults([]);
    setSelected(null);
    setCreateExerciseError("");
  }, []);

  const showCreatePrompt =
    options.active &&
    search.trim() !== "" &&
    results.length === 0 &&
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

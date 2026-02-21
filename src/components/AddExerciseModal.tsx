import { useEffect, useState } from "react";
import {
  getCollectionRef,
  getDocs,
  createDoc,
  query,
  where,
  orderBy,
  limit,
} from "../lib/firestore";
import type { Exercise } from "../types";
import { Modal } from "./Modal";

export interface AddExerciseModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (exerciseId: string, exerciseName: string) => void;
}

export function AddExerciseModal({
  open,
  onClose,
  onAdd,
}: AddExerciseModalProps) {
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseResults, setExerciseResults] = useState<
    Array<Exercise & { id: string }>
  >([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null
  );
  const [selectedExerciseDisplayName, setSelectedExerciseDisplayName] =
    useState<string | null>(null);
  const [createExerciseError, setCreateExerciseError] = useState("");

  useEffect(() => {
    if (!open || !exerciseSearch.trim()) {
      setExerciseResults([]);
      return;
    }
    let ignore = false;
    const term = exerciseSearch.trim().toLowerCase();
    const ref = getCollectionRef("exercises");
    const q = query(
      ref,
      where("nameLower", ">=", term),
      where("nameLower", "<=", term + "\uf8ff"),
      orderBy("nameLower"),
      limit(20)
    );
    getDocs(q).then((snap) => {
      if (ignore) return;
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Array<Exercise & { id: string }>;
      setExerciseResults(list);
    });
    return () => {
      ignore = true;
    };
  }, [open, exerciseSearch]);

  const resetAndClose = () => {
    setExerciseSearch("");
    setExerciseResults([]);
    setSelectedExerciseId(null);
    setSelectedExerciseDisplayName(null);
    setCreateExerciseError("");
    onClose();
  };

  const handleCreateExercise = async () => {
    const displayName = exerciseSearch.trim();
    if (!displayName) return;
    setCreateExerciseError("");
    const nameLower = displayName.toLowerCase();
    const ref = getCollectionRef("exercises");
    const existing = await getDocs(
      query(ref, where("nameLower", "==", nameLower))
    );
    if (!existing.empty) {
      setCreateExerciseError("An exercise with this name already exists");
      return;
    }
    const newId = await createDoc("exercises", {
      nameLower,
      displayName,
    } as unknown as Omit<Exercise, "id" | "createdAt" | "updatedAt">);
    setSelectedExerciseId(newId);
    setSelectedExerciseDisplayName(displayName);
    setExerciseSearch("");
  };

  const handleAdd = () => {
    if (!selectedExerciseId || !selectedExerciseDisplayName) return;
    const name =
      selectedExerciseDisplayName ??
      exerciseResults.find((e) => e.id === selectedExerciseId)?.displayName ??
      "—";
    onAdd(selectedExerciseId, name);
    resetAndClose();
  };

  return (
    <Modal open={open} onClose={resetAndClose} title="Add exercise to workout">
      {selectedExerciseId ? (
        <div className="mt-3 flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 px-4">
          <span className="flex-1 truncate text-sm font-medium text-gray-900">
            {selectedExerciseDisplayName ??
              exerciseResults.find((e) => e.id === selectedExerciseId)
                ?.displayName ??
              "—"}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedExerciseId(null);
              setSelectedExerciseDisplayName(null);
              setExerciseSearch("");
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-300 hover:text-gray-800"
            aria-label="Clear selection"
          >
            <span className="text-sm">✕</span>
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder="Search exercises"
            value={exerciseSearch}
            onChange={(e) => {
              setExerciseSearch(e.target.value);
              setCreateExerciseError("");
            }}
            className="mt-3 min-h-[44px] w-full rounded-xl border border-gray-300 px-4 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <ul className="mt-2 max-h-40 overflow-auto">
            {exerciseResults.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExerciseId(ex.id);
                    setSelectedExerciseDisplayName(ex.displayName);
                  }}
                  className="min-h-[44px] w-full rounded-lg px-3 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  {ex.displayName}
                </button>
              </li>
            ))}
          </ul>
          {exerciseSearch.trim() !== "" && exerciseResults.length === 0 && (
            <div className="mt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleCreateExercise()}
                className="min-h-[44px] w-full rounded-xl border border-dashed border-gray-400 bg-gray-50 font-medium text-gray-700 hover:border-indigo-500 hover:bg-indigo-100 hover:text-indigo-700"
              >
                Create exercise &ldquo;{exerciseSearch.trim()}&rdquo;
              </button>
              {createExerciseError && (
                <p className="text-sm text-red-600">{createExerciseError}</p>
              )}
            </div>
          )}
        </>
      )}
      {selectedExerciseId && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={resetAndClose}
            className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-700"
          >
            Add
          </button>
        </div>
      )}
    </Modal>
  );
}

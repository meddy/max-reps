import { useCallback, useEffect, useState, useTransition } from "react";
import { Link } from "react-router-dom";
import { useDataAccess } from "../../contexts/DataAccessContext";
import type { Exercise } from "../../types";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState } from "../../components/EmptyState";
import { IconPencil, IconPlus, IconTrash } from "../../components/Icons";
import { SortToggleButton } from "../../components/SortToggleButton";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Modal } from "../../components/Modal";

const PAGE_SIZE = 100;
const SORT_STORAGE_KEY = "max-reps-exercise-sort";

function getStoredSortOrder(): "asc" | "desc" {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (stored === "asc" || stored === "desc") return stored;
  } catch {
    /* ignore */
  }
  return "asc";
}

export function ExerciseList() {
  const dataAccess = useDataAccess();
  const [exercises, setExercises] = useState<Array<Exercise & { id: string }>>(
    []
  );
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() =>
    getStoredSortOrder()
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchExercises = useCallback(async () => {
    const list = await dataAccess.exercises.list({
      sort: sortOrder,
      search: search.trim() || undefined,
      limit: PAGE_SIZE,
    });
    setExercises(list);
  }, [dataAccess, search, sortOrder]);

  useEffect(() => {
    startTransition(() => {
      void fetchExercises();
    });
  }, [fetchExercises, startTransition]);

  const handleSortChange = (order: "asc" | "desc") => {
    setSortOrder(order);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, order);
    } catch {
      /* ignore */
    }
  };

  const handleCreate = async () => {
    const displayName = createName.trim();
    const nameLower = displayName.toLowerCase();
    if (!displayName) {
      setCreateError("Name is required");
      return;
    }
    const existing = await dataAccess.exercises.findByExactName(nameLower);
    if (existing) {
      setCreateError("An exercise with this name already exists");
      return;
    }
    setCreateError("");
    const id = await dataAccess.exercises.create({
      nameLower,
      displayName,
    });
    setCreateOpen(false);
    setCreateName("");
    const now = new Date();
    setExercises((prev) => {
      const next = [
        ...prev,
        {
          id,
          nameLower,
          displayName,
          createdAt: now,
          updatedAt: now,
        },
      ];
      return [...next].sort((a, b) => a.nameLower.localeCompare(b.nameLower));
    });
  };

  const handleEdit = async () => {
    if (!editId || !editName.trim()) return;
    const displayName = editName.trim();
    const nameLower = displayName.toLowerCase();
    const existing = await dataAccess.exercises.findByExactName(nameLower);
    if (existing && existing.id !== editId) {
      return;
    }
    await dataAccess.exercises.update(editId, { nameLower, displayName });
    setEditId(null);
    setEditName("");
    startTransition(() => void fetchExercises());
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await dataAccess.exercises.delete(deleteId);
    setDeleteId(null);
    startTransition(() => void fetchExercises());
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search exercises"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white px-4 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[120px]"
        />
        <SortToggleButton
          value={sortOrder}
          onChange={handleSortChange}
          ariaLabel="Sort exercises"
        />
        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setCreateError("");
            setCreateName("");
          }}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Add exercise"
          title="Add exercise"
        >
          <IconPlus className="size-6" />
        </button>
      </div>

      {isPending ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : exercises.length === 0 ? (
        <EmptyState
          title="No exercises"
          description="Add an exercise to get started."
          action={
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add exercise
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {exercises.map((ex) => (
            <li
              key={ex.id}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-100"
            >
              <Link
                to={`/exercises/${ex.id}`}
                className="min-h-[44px] flex-1 font-medium text-gray-900"
              >
                {ex.displayName}
              </Link>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditId(ex.id);
                    setEditName(ex.displayName);
                  }}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                  aria-label={`Edit ${ex.displayName}`}
                  title={`Edit ${ex.displayName}`}
                >
                  <IconPencil className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(ex.id)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-600 hover:bg-red-100"
                  aria-label={`Delete ${ex.displayName}`}
                  title={`Delete ${ex.displayName}`}
                >
                  <IconTrash className="size-6" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError("");
        }}
        title="New exercise"
      >
        <input
          type="text"
          placeholder="Exercise name"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          className="mt-3 w-full min-h-[44px] rounded-xl border border-gray-300 px-4 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          autoFocus
        />
        {createError && (
          <p className="mt-2 text-sm text-red-600">{createError}</p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setCreateOpen(false);
              setCreateError("");
            }}
            className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-700"
          >
            Create
          </button>
        </div>
      </Modal>

      <Modal
        open={!!editId}
        onClose={() => {
          setEditId(null);
          setEditName("");
        }}
        title="Edit exercise"
      >
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="mt-3 w-full min-h-[44px] rounded-xl border border-gray-300 px-4 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          autoFocus
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setEditName("");
            }}
            className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleEdit()}
            className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId != null}
        title="Delete exercise"
        message="This will not delete past set history. Continue?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

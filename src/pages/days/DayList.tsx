import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dataAccess } from "../../lib/dataAccess";
import type { Day } from "../../types";
import { EmptyState } from "../../components/EmptyState";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { IconPencil, IconPlus, IconTrash } from "../../components/Icons";
import { SortToggleButton } from "../../components/SortToggleButton";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Modal } from "../../components/Modal";

const PAGE_SIZE = 100;
const SORT_STORAGE_KEY = "max-reps-day-sort";

type DaySummaryItem = {
  exerciseName: string;
  numSets: number;
  repsLower: number;
  repsUpper: number;
};

function formatSetsReps(
  numSets: number,
  repsLower: number,
  repsUpper: number
): string {
  const reps =
    repsLower === repsUpper ? String(repsLower) : `${repsLower}–${repsUpper}`;
  return `${numSets}x${reps}`;
}

function getStoredSortOrder(): "asc" | "desc" {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (stored === "asc" || stored === "desc") return stored;
  } catch {
    /* ignore */
  }
  return "asc";
}

export function DayList() {
  const [days, setDays] = useState<Array<Day & { id: string }>>([]);
  const [summariesByDayId, setSummariesByDayId] = useState<
    Record<string, DaySummaryItem[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() =>
    getStoredSortOrder()
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchDays = useCallback(async () => {
    setLoading(true);
    const list = await dataAccess.days.list({
      sort: sortOrder,
      limit: PAGE_SIZE,
    });
    setDays(list);
    setLoading(false);
  }, [sortOrder]);

  const fetchSummaries = useCallback(async (dayIds: string[]) => {
    if (dayIds.length === 0) {
      setSummariesByDayId({});
      return;
    }
    const byDayMap =
      await dataAccess.templates.listForDaysWithExerciseNames(dayIds);
    const byDay: Record<string, DaySummaryItem[]> = {};
    for (const [dayId, templates] of byDayMap) {
      byDay[dayId] = templates.map((t) => ({
        exerciseName: t.exerciseDisplayName,
        numSets: t.numSets,
        repsLower: t.repsLower,
        repsUpper: t.repsUpper,
      }));
    }
    setSummariesByDayId(byDay);
  }, []);

  useEffect(() => {
    void fetchDays();
  }, [fetchDays]);

  useEffect(() => {
    void fetchSummaries(days.map((d) => d.id));
  }, [days, fetchSummaries]);

  const handleCreate = async () => {
    const displayName = createName.trim();
    const nameLower = displayName.toLowerCase();
    if (!displayName) {
      setCreateError("Name is required");
      return;
    }
    const existing = await dataAccess.days.findByExactName(nameLower);
    if (existing) {
      setCreateError("A day with this name already exists");
      return;
    }
    setCreateError("");
    const id = await dataAccess.days.create({
      nameLower,
      displayName,
    });
    setCreateOpen(false);
    setCreateName("");
    setDays((prev) => {
      const next = [
        ...prev,
        { id, nameLower, displayName } as Day & {
          id: string;
          createdAt: unknown;
          updatedAt: unknown;
        },
      ];
      return [...next].sort((a, b) =>
        sortOrder === "asc"
          ? a.nameLower.localeCompare(b.nameLower)
          : b.nameLower.localeCompare(a.nameLower)
      );
    });
  };

  const handleEdit = async () => {
    if (!editId || !editName.trim()) return;
    const displayName = editName.trim();
    const nameLower = displayName.toLowerCase();
    await dataAccess.days.update(editId, { nameLower, displayName });
    setEditId(null);
    setEditName("");
    void fetchDays();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await dataAccess.days.deleteWithTemplates(deleteId);
    setDeleteId(null);
    void fetchDays();
  };

  const handleSortChange = (order: "asc" | "desc") => {
    setSortOrder(order);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, order);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SortToggleButton
          value={sortOrder}
          onChange={handleSortChange}
          ariaLabel="Sort days"
        />
        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setCreateError("");
            setCreateName("");
          }}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Add day"
          title="Add day"
        >
          <IconPlus className="size-6" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : days.length === 0 ? (
        <EmptyState
          title="No days"
          description="Add a day template to get started."
          action={
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add day
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {days.map((day) => {
            const summary = summariesByDayId[day.id] ?? [];
            return (
              <li
                key={day.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm transition-colors hover:bg-gray-100"
              >
                <Link
                  to={`/days/${day.id}`}
                  className="min-h-[44px] flex-1 font-medium text-gray-900"
                >
                  <span className="block">{day.displayName}</span>
                  {summary.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm font-normal text-gray-500">
                      {summary.map((item, i) => (
                        <li key={i}>
                          {item.exerciseName}{" "}
                          {formatSetsReps(
                            item.numSets,
                            item.repsLower,
                            item.repsUpper
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Link>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(day.id);
                      setEditName(day.displayName);
                    }}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                    aria-label={`Edit ${day.displayName}`}
                    title={`Edit ${day.displayName}`}
                  >
                    <IconPencil className="size-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(day.id)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-600 hover:bg-red-100"
                    aria-label={`Delete ${day.displayName}`}
                    title={`Delete ${day.displayName}`}
                  >
                    <IconTrash className="size-6" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError("");
        }}
        title="New day"
      >
        <input
          type="text"
          placeholder="Day name (e.g. Push, Legs)"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          className="mt-3 min-h-[44px] w-full rounded-xl border border-gray-300 px-4 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
        title="Edit day"
      >
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="mt-3 min-h-[44px] w-full rounded-xl border border-gray-300 px-4 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
        title="Delete day"
        message="This will delete all templates for this day. Continue?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

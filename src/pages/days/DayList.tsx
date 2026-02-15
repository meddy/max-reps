import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCollectionRef,
  getDocRef,
  createDoc,
  updateDocById,
  deleteDocAndRelated,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "../../lib/firestore";
import type { Day, Exercise, ExerciseSetTemplate } from "../../types";
import { EmptyState } from "../../components/EmptyState";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Modal } from "../../components/Modal";

const PAGE_SIZE = 100;
const TEMPLATES_LIMIT = 500;
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
    const ref = getCollectionRef("days");
    const q = query(ref, orderBy("nameLower", sortOrder), limit(PAGE_SIZE));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Array<Day & { id: string }>;
    setDays(list);
    setLoading(false);
  }, [sortOrder]);

  const fetchSummaries = useCallback(async (dayIds: string[]) => {
    if (dayIds.length === 0) {
      setSummariesByDayId({});
      return;
    }
    const dayIdSet = new Set(dayIds);
    const ref = getCollectionRef("exerciseSetTemplates");
    const q = query(ref, limit(TEMPLATES_LIMIT));
    const snapshot = await getDocs(q);
    const templates = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Array<ExerciseSetTemplate & { id: string }>;
    const forOurDays = templates
      .filter((t) => dayIdSet.has(t.dayId))
      .sort((a, b) =>
        a.dayId !== b.dayId ? a.dayId.localeCompare(b.dayId) : a.order - b.order
      );
    const exerciseIds = [...new Set(forOurDays.map((t) => t.exerciseId))];
    const nameMap: Record<string, string> = {};
    await Promise.all(
      exerciseIds.map(async (eid) => {
        const snap = await getDoc(getDocRef("exercises", eid));
        if (snap.exists()) {
          nameMap[eid] = (snap.data() as Exercise).displayName;
        }
      })
    );
    const byDay: Record<string, DaySummaryItem[]> = {};
    for (const t of forOurDays) {
      const list = byDay[t.dayId] ?? [];
      list.push({
        exerciseName: nameMap[t.exerciseId] ?? "—",
        numSets: t.numSets,
        repsLower: t.repsLower,
        repsUpper: t.repsUpper,
      });
      byDay[t.dayId] = list;
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
    const ref = getCollectionRef("days");
    const existing = await getDocs(
      query(ref, where("nameLower", "==", nameLower))
    );
    if (!existing.empty) {
      setCreateError("A day with this name already exists");
      return;
    }
    setCreateError("");
    const id = await createDoc("days", {
      nameLower,
      displayName,
    } as unknown as Omit<Day, "id" | "createdAt" | "updatedAt">);
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
    await updateDocById("days", editId, { nameLower, displayName });
    setEditId(null);
    setEditName("");
    void fetchDays();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteDocAndRelated("days", deleteId, [
      { collection: "exerciseSetTemplates", field: "dayId" },
    ]);
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
        <div
          className="flex rounded-xl border border-gray-300 bg-white p-0.5"
          role="group"
          aria-label="Sort days"
        >
          <button
            type="button"
            onClick={() => handleSortChange("asc")}
            className={`min-h-[40px] rounded-lg px-3 text-sm font-medium transition-colors ${
              sortOrder === "asc"
                ? "bg-indigo-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            A → Z
          </button>
          <button
            type="button"
            onClick={() => handleSortChange("desc")}
            className={`min-h-[40px] rounded-lg px-3 text-sm font-medium transition-colors ${
              sortOrder === "desc"
                ? "bg-indigo-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Z → A
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setCreateError("");
            setCreateName("");
          }}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Add day"
        >
          <svg
            className="size-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
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
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
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
                className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm"
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
                    className="min-h-[44px] min-w-[44px] rounded-lg px-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    aria-label={`Edit ${day.displayName}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(day.id)}
                    className="min-h-[44px] min-w-[44px] rounded-lg px-2 text-red-600 hover:bg-red-50"
                    aria-label={`Delete ${day.displayName}`}
                  >
                    Delete
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
            className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-500"
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
            className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 font-medium text-white hover:bg-indigo-500"
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

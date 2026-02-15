import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCollectionRef,
  createDoc,
  updateDocById,
  deleteDocAndRelated,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "../../lib/firestore";
import type { Day } from "../../types";
import { EmptyState } from "../../components/EmptyState";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { LoadingSpinner } from "../../components/LoadingSpinner";

const PAGE_SIZE = 100;

export function DayList() {
  const [days, setDays] = useState<Array<Day & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchDays = useCallback(async () => {
    setLoading(true);
    const ref = getCollectionRef("days");
    const q = query(ref, orderBy("nameLower"), limit(PAGE_SIZE));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Array<Day & { id: string }>;
    setDays(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchDays();
  }, [fetchDays]);

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
      next.sort((a, b) => a.nameLower.localeCompare(b.nameLower));
      return next;
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
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
          {days.map((day) => (
            <li
              key={day.id}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
            >
              <Link
                to={`/days/${day.id}`}
                className="min-h-[44px] flex-1 font-medium text-gray-900"
              >
                {day.displayName}
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
          ))}
        </ul>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">New day</h3>
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
          </div>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Edit day</h3>
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
          </div>
        </div>
      )}

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

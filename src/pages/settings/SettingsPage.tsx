import { useState } from "react";
import {
  getCollectionRef,
  getDocs,
  query,
  orderBy,
  limit,
} from "../../lib/firestore";
import { useAuth } from "../../contexts/AuthContext";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const exportJson = async () => {
    setLoading(true);
    try {
      const collections = [
        "exercises",
        "days",
        "exerciseSetTemplates",
        "workouts",
        "sets",
      ] as const;
      const results = await Promise.all(
        collections.map(async (name) => {
          const ref = getCollectionRef(name);
          const q = query(ref, limit(10000));
          const snap = await getDocs(q);
          return [
            name,
            snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          ] as const;
        })
      );
      const data = Object.fromEntries(results) as Record<string, unknown[]>;
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      downloadBlob(
        blob,
        `max-reps-export-${new Date().toISOString().slice(0, 10)}.json`
      );
    } finally {
      setLoading(false);
    }
  };

  const exportSetsCsv = async () => {
    setLoading(true);
    try {
      const ref = getCollectionRef("sets");
      const q = query(ref, orderBy("performedAt", "desc"), limit(10000));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => {
        const x = d.data() as Record<string, unknown>;
        return [
          d.id,
          x.workoutId,
          x.exerciseId,
          x.exerciseNameSnapshot,
          x.reps,
          x.weight,
          x.unit,
          x.note,
          x.performedAt != null &&
          typeof (x.performedAt as { toDate?: () => Date }).toDate ===
            "function"
            ? (x.performedAt as { toDate: () => Date }).toDate().toISOString()
            : "",
          x.order,
        ];
      });
      const header =
        "id,workoutId,exerciseId,exerciseNameSnapshot,reps,weight,unit,note,performedAt,order\n";
      const csv =
        header +
        rows
          .map((r) =>
            r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
          )
          .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      downloadBlob(
        blob,
        `max-reps-sets-${new Date().toISOString().slice(0, 10)}.csv`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-gray-900">Settings</h2>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-medium text-gray-900">UID</h3>
        <p className="mt-1 text-xs text-gray-500">
          Your Firebase UID (must match firestore.rules and VITE_ALLOWED_UID).
        </p>
        {user && (
          <p
            className="mt-2 truncate font-mono text-sm text-gray-700"
            title={user.uid}
          >
            {user.uid}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-medium text-gray-900">Export</h3>
        <p className="mt-1 text-xs text-gray-500">
          Download your data as JSON (all collections) or CSV (sets only).
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void exportJson()}
            className="w-fit min-h-[44px] rounded-xl bg-indigo-600 px-4 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Exporting…" : "Export all data (JSON)"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void exportSetsCsv()}
            className="w-fit min-h-[44px] rounded-xl border border-gray-300 bg-white px-4 font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {loading ? "Exporting…" : "Export sets (CSV)"}
          </button>
        </div>
      </section>
    </div>
  );
}

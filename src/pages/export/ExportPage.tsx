import { useState } from "react";
import {
  getCollectionRef,
  getDocs,
  query,
  orderBy,
  limit,
} from "../../lib/firestore";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportPage() {
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
      const data: Record<string, unknown[]> = {};
      for (const name of collections) {
        const ref = getCollectionRef(name);
        const q = query(ref, limit(10000));
        const snap = await getDocs(q);
        data[name] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      }
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
          x.performedAt != null && typeof (x.performedAt as { toDate?: () => Date }).toDate === "function"
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
          .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
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
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-gray-900">Export data</h2>
      <p className="text-sm text-gray-500">
        Download your data as JSON (all collections) or CSV (sets only).
      </p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void exportJson()}
          className="min-h-[44px] rounded-xl bg-indigo-600 px-4 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Exporting…" : "Export all data (JSON)"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void exportSetsCsv()}
          className="min-h-[44px] rounded-xl border border-gray-300 bg-white font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Exporting…" : "Export sets (CSV)"}
        </button>
      </div>
    </div>
  );
}

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TopSetChartPoint {
  dateMs: number;
  dateLabel: string;
  weight: number;
  reps: number;
  label: string;
}

interface TopSetChartProps {
  data: TopSetChartPoint[];
}

export function TopSetChart({ data }: TopSetChartProps) {
  if (data.length === 0) return null;

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
          />
          <YAxis
            dataKey="weight"
            domain={["auto", "auto"]}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "0.5rem",
              border: "1px solid #e5e7eb",
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as TopSetChartPoint;
              return (
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <p className="font-medium text-gray-900">
                    {p.reps} × {p.weight} lbs
                  </p>
                  <p className="text-sm text-gray-500">{p.dateLabel}</p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#4f46e5"
            strokeWidth={2}
            dot={{ fill: "#4f46e5", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

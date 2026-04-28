"use client";

import { type SignalSource } from "@prisma/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DashboardKpiHealthSlice,
  DashboardSourceActivityPoint,
} from "@/lib/dashboard";

interface KpiHealthBreakdownChartProps {
  data: DashboardKpiHealthSlice[];
}

interface SourceActivityChartProps {
  data: DashboardSourceActivityPoint[];
}

const SOURCE_LABELS: Record<SignalSource, string> = {
  SLACK: "Slack",
  FATHOM: "Fathom",
  AM_MEETING: "AM Meeting",
  VITALLY: "Vitally",
  SALESFORCE: "Salesforce",
  PERSONAS: "Personas",
  SHAREPOINT: "SharePoint",
  JIRA: "Jira",
  GOOGLE_DRIVE: "Google Drive",
};

const SOURCE_COLORS: Record<SignalSource, string> = {
  SLACK: "#0F172A",
  FATHOM: "#1E293B",
  AM_MEETING: "#334155",
  VITALLY: "#475569",
  SALESFORCE: "#64748B",
  PERSONAS: "#94A3B8",
  SHAREPOINT: "#CBD5E1",
  JIRA: "#111827",
  GOOGLE_DRIVE: "#3B82F6",
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      {label ? <p className="text-xs font-medium text-slate-500">{label}</p> : null}
      <div className="mt-1 space-y-1">
        {payload.map((item) => (
          <div key={`${item.name}-${item.value}`} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color ?? "#0F172A" }}
            />
            <span className="text-slate-600">{item.name}</span>
            <span className="font-medium text-slate-900">{item.value ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiHealthBreakdownChart({
  data,
}: KpiHealthBreakdownChartProps) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
        KPI health will appear here once scoring runs across your portfolio.
      </div>
    );
  }

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={68}
            outerRadius={92}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((slice) => (
              <Cell key={slice.status} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend
            verticalAlign="bottom"
            formatter={(value) => value}
            wrapperStyle={{ fontSize: "12px", paddingTop: "16px", color: "#475569" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourceActivityChart({ data }: SourceActivityChartProps) {
  const activeSources = (
    Object.keys(SOURCE_LABELS) as SignalSource[]
  ).filter((source) => data.some((point) => point[source] > 0));

  if (activeSources.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
        No recent signals yet. Trigger a sync to populate source activity.
      </div>
    );
  }

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 12, left: -24, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="dateLabel"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#64748B" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#64748B" }}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: "12px", paddingTop: "16px", color: "#475569" }}
            formatter={(value) => SOURCE_LABELS[value as SignalSource] ?? value}
          />
          {activeSources.map((source) => (
            <Bar
              key={source}
              dataKey={source}
              stackId="signals"
              fill={SOURCE_COLORS[source]}
              radius={[3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

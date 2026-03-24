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
  SLACK: "#4A154B",
  FATHOM: "#FF6B35",
  AM_MEETING: "#8B5CF6",
  VITALLY: "#7C3AED",
  SALESFORCE: "#00A1E0",
  PERSONAS: "#059669",
  SHAREPOINT: "#0078D4",
  JIRA: "#0052CC",
  GOOGLE_DRIVE: "#4285F4",
};

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
          <Tooltip />
          <Legend
            verticalAlign="bottom"
            formatter={(value) => value}
            wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
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
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="dateLabel"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#6B7280" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#6B7280" }}
          />
          <Tooltip />
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
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

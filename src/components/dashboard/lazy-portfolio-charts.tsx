"use client";

import dynamic from "next/dynamic";
import type {
  DashboardKpiHealthSlice,
  DashboardSourceActivityPoint,
} from "@/lib/dashboard";

const KpiHealthBreakdownChartInner = dynamic(
  () =>
    import("./portfolio-charts").then((mod) => mod.KpiHealthBreakdownChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
);

const SourceActivityChartInner = dynamic(
  () => import("./portfolio-charts").then((mod) => mod.SourceActivityChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
);

function ChartSkeleton() {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-[24px] bg-slate-50/80 text-sm text-slate-400">
      Loading chart...
    </div>
  );
}

export function LazyKpiHealthBreakdownChart({
  data,
}: {
  data: DashboardKpiHealthSlice[];
}) {
  return <KpiHealthBreakdownChartInner data={data} />;
}

export function LazySourceActivityChart({
  data,
}: {
  data: DashboardSourceActivityPoint[];
}) {
  return <SourceActivityChartInner data={data} />;
}

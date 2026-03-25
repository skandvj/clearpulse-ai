"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type HealthStatus = "HEALTHY" | "AT_RISK" | "CRITICAL" | "UNKNOWN";
type HealthTrend = "IMPROVING" | "STABLE" | "DECLINING";

const STATUS_STYLES: Record<HealthStatus, string> = {
  HEALTHY: "bg-emerald-50/80 text-emerald-700 border-emerald-200/80",
  AT_RISK: "bg-amber-50/80 text-amber-700 border-amber-200/80",
  CRITICAL: "bg-red-50/80 text-red-700 border-red-200/80",
  UNKNOWN: "bg-gray-50/80 text-gray-500 border-gray-200/80",
};

const STATUS_LABELS: Record<HealthStatus, string> = {
  HEALTHY: "Healthy",
  AT_RISK: "At Risk",
  CRITICAL: "Critical",
  UNKNOWN: "Unknown",
};

const TREND_ICONS: Record<HealthTrend, string> = {
  IMPROVING: "↑",
  STABLE: "→",
  DECLINING: "↓",
};

const TREND_STYLES: Record<HealthTrend, string> = {
  IMPROVING: "text-emerald-600",
  STABLE: "text-gray-500",
  DECLINING: "text-red-600",
};

interface HealthStatusBadgeProps {
  status: HealthStatus;
  className?: string;
}

export function HealthStatusBadge({ status, className }: HealthStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        STATUS_STYLES[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

interface HealthTrendIndicatorProps {
  trend: HealthTrend;
  className?: string;
}

export function HealthTrendIndicator({ trend, className }: HealthTrendIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium",
        TREND_STYLES[trend],
        className
      )}
    >
      {TREND_ICONS[trend]} {trend.charAt(0) + trend.slice(1).toLowerCase()}
    </span>
  );
}

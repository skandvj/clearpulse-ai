"use client";

import { cn } from "@/lib/utils";

interface HealthRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  className?: string;
}

function getHealthColor(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 40) return "#F59E0B";
  return "#EF4444";
}

function getTrackColor(score: number): string {
  if (score >= 70) return "#D1FAE5";
  if (score >= 40) return "#FEF3C7";
  return "#FEE2E2";
}

export function HealthRing({
  score,
  size = 48,
  strokeWidth = 4,
  showLabel = true,
  className,
}: HealthRingProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedScore / 100) * circumference;
  const color = getHealthColor(clampedScore);
  const trackColor = getTrackColor(clampedScore);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {showLabel && (
        <span
          className="absolute text-center font-semibold leading-none"
          style={{
            fontSize: size * 0.26,
            color,
          }}
        >
          {clampedScore}
        </span>
      )}
    </div>
  );
}

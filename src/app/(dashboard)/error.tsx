"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/layout/error-state";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="This dashboard view couldn't load"
      description="The rest of ClearPulse is still available. Retry this view, or jump back to the portfolio dashboard while we keep the failure contained."
      error={error}
      onRetry={reset}
      homeHref="/dashboard"
      homeLabel="Open Dashboard"
    />
  );
}

"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/layout/error-state";

export default function RootError({
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
      title="ClearPulse hit an unexpected error"
      description="We couldn't finish loading this page. You can retry from here or head back to the app entry point."
      error={error}
      onRetry={reset}
      homeHref="/"
      homeLabel="Return Home"
      fullscreen
    />
  );
}

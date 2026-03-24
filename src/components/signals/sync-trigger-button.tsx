"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTriggerSync } from "@/lib/hooks/use-signals";
import type { SignalSource } from "@/components/ui/source-badge";

interface SyncTriggerButtonProps {
  accountId: string;
  source?: SignalSource;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function SyncTriggerButton({
  accountId,
  source,
  variant = "default",
  size = "default",
  className,
}: SyncTriggerButtonProps) {
  const { mutate, isPending } = useTriggerSync();

  const handleSync = () => {
    mutate(
      { accountId, source },
      {
        onSuccess: (data) => {
          const totalNew = data.results.reduce(
            (sum, r) => sum + r.newSignals,
            0
          );
          toast.success(
            source
              ? `Synced ${source}: ${totalNew} new signal${totalNew !== 1 ? "s" : ""}`
              : `Bulk sync complete: ${totalNew} new signal${totalNew !== 1 ? "s" : ""}`
          );
        },
        onError: (err) => {
          toast.error(err.message || "Sync failed");
        },
      }
    );
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={isPending}
      className={className}
    >
      <RefreshCw
        className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`}
      />
      {isPending
        ? "Syncing…"
        : source
          ? `Sync ${source}`
          : "Sync All Sources"}
    </Button>
  );
}

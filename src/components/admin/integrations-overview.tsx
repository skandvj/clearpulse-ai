"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, PlugZap, RefreshCw, SearchX } from "lucide-react";
import { useIntegrationStatuses, useTestIntegration } from "@/lib/hooks/use-integrations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SourceBadge, type SignalSource } from "@/components/ui/source-badge";

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({
  status,
}: {
  status: "CONNECTED" | "PARTIAL" | "DISCONNECTED" | "ERROR";
}) {
  if (status === "CONNECTED") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        Connected
      </Badge>
    );
  }

  if (status === "ERROR") {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Error</Badge>
    );
  }

  if (status === "PARTIAL") {
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
        Partial
      </Badge>
    );
  }

  return (
    <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">
      Disconnected
    </Badge>
  );
}

export function IntegrationsOverview() {
  const integrationsQuery = useIntegrationStatuses();
  const testIntegration = useTestIntegration();
  const [testingSource, setTestingSource] = useState<SignalSource | null>(null);

  const handleTest = async (source: SignalSource) => {
    try {
      setTestingSource(source);
      const result = await testIntegration.mutateAsync(source);
      if (result.ok) {
        toast.success(`${source} looks ready. ${result.message}`);
      } else {
        toast.warning(`${source}: ${result.message}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to test integration");
    } finally {
      setTestingSource(null);
    }
  };

  if (integrationsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        Loading integration status…
      </div>
    );
  }

  if (integrationsQuery.error || !integrationsQuery.data) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        {integrationsQuery.error?.message || "Failed to load integrations"}
      </div>
    );
  }

  const { integrations, summary } = integrationsQuery.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Connected</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {summary.connected}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Needs Attention</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {summary.partial + summary.disconnected + summary.error}
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Errors</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {summary.error}
              </p>
            </div>
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <SearchX className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Signals Stored</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {summary.totalSignals}
              </p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <PlugZap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {integrations.map((integration) => (
          <Card
            key={integration.source}
            className="rounded-2xl border-gray-100 shadow-sm transition-shadow hover:shadow-md"
          >
            <CardHeader className="space-y-3 pb-3">
              <div className="flex items-start justify-between gap-3">
                <SourceBadge source={integration.source} size="md" />
                <StatusBadge status={integration.status} />
              </div>
              <CardTitle className="text-base font-semibold">
                {integration.authType}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">
                {integration.description}
              </p>

              <div className="grid gap-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Config Coverage</span>
                  <span className="font-medium text-slate-900">
                    {integration.configuredCount}/{integration.requiredCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Signals Stored</span>
                  <span className="font-medium text-slate-900">
                    {integration.signalsStored}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last Sync</span>
                  <span className="font-medium text-slate-900">
                    {formatDateTime(integration.lastSyncedAt)}
                  </span>
                </div>
              </div>

              {integration.missingEnv.length > 0 ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
                  Missing: {integration.missingEnv.join(", ")}
                </div>
              ) : null}

              {integration.lastJobError ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                  {integration.lastJobError}
                </div>
              ) : null}

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => handleTest(integration.source)}
                disabled={testingSource === integration.source}
              >
                <RefreshCw
                  className={`h-4 w-4 ${testingSource === integration.source ? "animate-spin" : ""}`}
                />
                {testingSource === integration.source
                  ? "Testing…"
                  : "Test Configuration"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

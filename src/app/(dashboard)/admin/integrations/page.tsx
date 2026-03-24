import { PageWrapper } from "@/components/layout/page-wrapper";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SourceBadge } from "@/components/ui/source-badge";
import type { SignalSource } from "@/components/ui/source-badge";
import { Badge } from "@/components/ui/badge";

const SOURCES: SignalSource[] = [
  "SLACK",
  "FATHOM",
  "AM_MEETING",
  "VITALLY",
  "SALESFORCE",
  "PERSONAS",
  "SHAREPOINT",
  "JIRA",
  "GOOGLE_DRIVE",
];

export default function AdminIntegrationsPage() {
  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            Integrations
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure and manage all 9 data source connections
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SOURCES.map((source) => (
            <Card
              key={source}
              className="rounded-2xl border-gray-100 shadow-sm transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <SourceBadge source={source} size="md" />
                  <Badge
                    variant="outline"
                    className="border-gray-200 bg-gray-50 text-xs text-gray-500"
                  >
                    Disconnected
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
                  Configuration available in Phase 9.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}

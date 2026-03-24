import { PageWrapper } from "@/components/layout/page-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

export default function AdminSyncPage() {
  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            Sync Console
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor and manage data ingestion jobs across all sources
          </p>
        </div>

        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Job Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                <RefreshCw className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                No sync jobs yet
              </h3>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Configure integrations and trigger your first sync to see jobs here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}

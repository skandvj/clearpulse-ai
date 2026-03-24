import { PageWrapper } from "@/components/layout/page-wrapper";
import { AdminSyncConsole } from "@/components/admin/sync-console";

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

        <AdminSyncConsole />
      </div>
    </PageWrapper>
  );
}

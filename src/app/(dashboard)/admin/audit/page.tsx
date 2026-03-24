import { PageWrapper } from "@/components/layout/page-wrapper";
import { AuditLogViewer } from "@/components/admin/audit-log-viewer";

export default function AdminAuditPage() {
  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            Audit Log
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track all system actions — KPI edits, syncs, role changes, report downloads
          </p>
        </div>

        <AuditLogViewer />
      </div>
    </PageWrapper>
  );
}

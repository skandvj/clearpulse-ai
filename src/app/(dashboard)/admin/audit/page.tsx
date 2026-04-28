import { PageWrapper } from "@/components/layout/page-wrapper";
import { AuditLogViewer } from "@/components/admin/audit-log-viewer";

export default function AdminAuditPage() {
  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-none">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            Audit Log
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review changes, exports, and administrative activity across the product.
          </p>
        </div>

        <AuditLogViewer />
      </div>
    </PageWrapper>
  );
}

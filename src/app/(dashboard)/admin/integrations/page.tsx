import { PageWrapper } from "@/components/layout/page-wrapper";
import { LazyIntegrationsOverview } from "@/components/admin/lazy-admin-panels";

export default function AdminIntegrationsPage() {
  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-none">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            Integrations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure data sources and AI providers from one operational workspace.
          </p>
        </div>

        <LazyIntegrationsOverview />
      </div>
    </PageWrapper>
  );
}

import { PageWrapper } from "@/components/layout/page-wrapper";
import { IntegrationsOverview } from "@/components/admin/integrations-overview";

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

        <IntegrationsOverview />
      </div>
    </PageWrapper>
  );
}

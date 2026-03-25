import { PageWrapper } from "@/components/layout/page-wrapper";
import { IntegrationsOverview } from "@/components/admin/integrations-overview";

export default function AdminIntegrationsPage() {
  return (
    <PageWrapper>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            Integrations
          </h1>
        </div>

        <IntegrationsOverview />
      </div>
    </PageWrapper>
  );
}

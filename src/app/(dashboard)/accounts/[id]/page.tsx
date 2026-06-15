import { PageWrapper } from "@/components/layout/page-wrapper";
import { LazyAccountOverview } from "@/components/accounts/lazy-account-pages";

interface AccountPageProps {
  params: { id: string };
}

export default function AccountPage({ params }: AccountPageProps) {
  return (
    <PageWrapper>
      <LazyAccountOverview accountId={params.id} />
    </PageWrapper>
  );
}

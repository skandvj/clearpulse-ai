import { PageWrapper } from "@/components/layout/page-wrapper";
import { AccountOverview } from "@/components/accounts/account-overview";

interface AccountPageProps {
  params: { id: string };
}

export default function AccountPage({ params }: AccountPageProps) {
  return (
    <PageWrapper>
      <AccountOverview accountId={params.id} />
    </PageWrapper>
  );
}

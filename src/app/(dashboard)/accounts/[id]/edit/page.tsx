import { LazyAccountEditForm } from "@/components/accounts/lazy-account-pages";
import { PageWrapper } from "@/components/layout/page-wrapper";

interface AccountEditPageProps {
  params: { id: string };
}

export default function AccountEditPage({ params }: AccountEditPageProps) {
  return (
    <PageWrapper>
      <LazyAccountEditForm accountId={params.id} />
    </PageWrapper>
  );
}

import { AccountEditForm } from "@/components/accounts/account-edit-form";
import { PageWrapper } from "@/components/layout/page-wrapper";

interface AccountEditPageProps {
  params: { id: string };
}

export default function AccountEditPage({ params }: AccountEditPageProps) {
  return (
    <PageWrapper>
      <AccountEditForm accountId={params.id} />
    </PageWrapper>
  );
}

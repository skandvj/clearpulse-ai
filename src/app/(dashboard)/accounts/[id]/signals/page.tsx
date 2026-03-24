import { PageWrapper } from "@/components/layout/page-wrapper";
import { SignalBrowser } from "@/components/signals/signal-browser";

interface SignalsPageProps {
  params: { id: string };
}

export default function SignalsPage({ params }: SignalsPageProps) {
  return (
    <PageWrapper>
      <SignalBrowser accountId={params.id} />
    </PageWrapper>
  );
}

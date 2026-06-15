import { PageWrapper } from "@/components/layout/page-wrapper";
import { LazySignalBrowser } from "@/components/signals/lazy-signal-browser";

interface SignalsPageProps {
  params: { id: string };
}

export default function SignalsPage({ params }: SignalsPageProps) {
  return (
    <PageWrapper>
      <LazySignalBrowser accountId={params.id} />
    </PageWrapper>
  );
}

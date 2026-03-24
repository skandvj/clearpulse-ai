import { PageSkeleton } from "@/components/ui/loading-skeleton";

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[#F7F8FA] px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <PageSkeleton />
      </div>
    </div>
  );
}

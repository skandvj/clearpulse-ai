"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const SignalBrowserInner = dynamic(
  () => import("./signal-browser").then((mod) => mod.SignalBrowser),
  {
    ssr: false,
    loading: () => <SignalBrowserSkeleton />,
  }
);

function SignalBrowserSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-none">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-none">
        <Skeleton className="h-10 w-full rounded-2xl" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-10 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full rounded-2xl" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

export function LazySignalBrowser({ accountId }: { accountId: string }) {
  return <SignalBrowserInner accountId={accountId} />;
}

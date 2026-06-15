"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const AccountOverviewInner = dynamic(
  () => import("./account-overview").then((mod) => mod.AccountOverview),
  {
    ssr: false,
    loading: () => <AccountOverviewSkeleton />,
  }
);

const AccountEditFormInner = dynamic(
  () => import("./account-edit-form").then((mod) => mod.AccountEditForm),
  {
    ssr: false,
    loading: () => <AccountEditFormSkeleton />,
  }
);

function AccountOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-none">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Skeleton className="h-72 w-full rounded-3xl" />
          <Skeleton className="h-80 w-full rounded-3xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-52 w-full rounded-3xl" />
          <Skeleton className="h-60 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

function AccountEditFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-none">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-72 w-full rounded-3xl" />
      <Skeleton className="h-96 w-full rounded-3xl" />
    </div>
  );
}

export function LazyAccountOverview({ accountId }: { accountId: string }) {
  return <AccountOverviewInner accountId={accountId} />;
}

export function LazyAccountEditForm({ accountId }: { accountId: string }) {
  return <AccountEditFormInner accountId={accountId} />;
}

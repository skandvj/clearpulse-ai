"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const UserManagementInner = dynamic(
  () => import("./user-management").then((mod) => mod.UserManagement),
  {
    ssr: false,
    loading: () => <TablePanelSkeleton />,
  }
);

const IntegrationsOverviewInner = dynamic(
  () =>
    import("./integrations-overview").then((mod) => mod.IntegrationsOverview),
  {
    ssr: false,
    loading: () => <StackedPanelSkeleton />,
  }
);

const AdminSyncConsoleInner = dynamic(
  () => import("./sync-console").then((mod) => mod.AdminSyncConsole),
  {
    ssr: false,
    loading: () => <StackedPanelSkeleton />,
  }
);

function TablePanelSkeleton() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-none">
      <Skeleton className="h-10 w-64 max-w-full rounded-2xl" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function StackedPanelSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full rounded-3xl" />
      <Skeleton className="h-72 w-full rounded-3xl" />
    </div>
  );
}

export function LazyUserManagement({
  currentUserId,
}: {
  currentUserId: string;
}) {
  return <UserManagementInner currentUserId={currentUserId} />;
}

export function LazyIntegrationsOverview() {
  return <IntegrationsOverviewInner />;
}

export function LazyAdminSyncConsole() {
  return <AdminSyncConsoleInner />;
}

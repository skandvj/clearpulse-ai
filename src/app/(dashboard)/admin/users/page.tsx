import { redirect } from "next/navigation";
import { PageWrapper } from "@/components/layout/page-wrapper";
import { LazyUserManagement } from "@/components/admin/lazy-admin-panels";
import { getServerUser } from "@/lib/auth-helpers";

export default async function AdminUsersPage() {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-none">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            User Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage roles, access, and account status for the workspace.
          </p>
        </div>

        <LazyUserManagement currentUserId={user.id} />
      </div>
    </PageWrapper>
  );
}

import { redirect } from "next/navigation";
import { PageWrapper } from "@/components/layout/page-wrapper";
import { UserManagement } from "@/components/admin/user-management";
import { getServerUser } from "@/lib/auth-helpers";

export default async function AdminUsersPage() {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            User Management
          </h1>
        </div>

        <UserManagement currentUserId={user.id} />
      </div>
    </PageWrapper>
  );
}

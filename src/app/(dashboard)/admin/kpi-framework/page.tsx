import { redirect } from "next/navigation";
import { PageWrapper } from "@/components/layout/page-wrapper";
import { AdminKpiFrameworkPanel } from "@/components/admin/kpi-framework-panel";
import { getServerUser } from "@/lib/auth-helpers";

export default async function AdminKpiFrameworkPage() {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-none">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
            KPI Framework
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Govern how evidence becomes KPIs, blockers, milestones, and context.
          </p>
        </div>

        <AdminKpiFrameworkPanel />
      </div>
    </PageWrapper>
  );
}

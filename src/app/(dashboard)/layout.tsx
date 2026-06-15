import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CurrentUserProvider } from "@/components/providers/current-user-provider";
import { getServerUser } from "@/lib/auth-helpers";
import type { ReactNode } from "react";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <CurrentUserProvider user={user}>
      <div className="relative flex min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_26%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.09),transparent_22%),radial-gradient(circle_at_bottom,rgba(15,23,42,0.05),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-[7.5rem] hidden w-px bg-white/40 lg:block" />
        <Sidebar />
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1520px] px-4 pb-8 pt-5 lg:px-8 lg:pb-10 lg:pt-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </CurrentUserProvider>
  );
}

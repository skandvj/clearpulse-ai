"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@prisma/client";
import { BrandMark } from "@/components/brand/brand-mark";
import { useCurrentUser } from "@/components/providers/current-user-provider";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { getNavItemsForRole } from "@/lib/navigation";
import { ChevronLeft, ChevronRight, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function getNavGroups(role: Role) {
  const items = getNavItemsForRole(role);

  return [
    {
      label: "Workspace",
      items: items.filter((item) => !item.href.startsWith("/admin")),
    },
    {
      label: "Admin",
      items: items.filter((item) => item.href.startsWith("/admin")),
    },
  ].filter((group) => group.items.length > 0);
}

export function Sidebar() {
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const {
    sidebarCollapsed,
    toggleSidebar,
    sidebarMobileOpen,
    setSidebarMobileOpen,
  } = useAppStore();

  const role = currentUser?.role ?? ("VIEWER" as Role);
  const navGroups = getNavGroups(role);
  const workspaceName = currentUser?.organizationName ?? "Private Workspace";
  const initials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : currentUser?.email?.slice(0, 2).toUpperCase() ?? "CP";

  return (
    <>
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col p-4 text-slate-900 transition-all duration-300",
          sidebarCollapsed ? "w-[108px]" : "w-[288px]",
          "lg:relative",
          sidebarMobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="glass-panel flex h-full flex-col overflow-hidden rounded-[32px]">
          <div className="flex h-20 items-start justify-between gap-3 px-4 pb-2 pt-4">
            {!sidebarCollapsed && (
              <Link
                href="/dashboard"
                className="flex min-w-0 flex-1 items-center gap-3 text-[15px] font-semibold tracking-tight text-slate-950"
              >
                <BrandMark alt="" />
                <div className="min-w-0">
                  <span className="block truncate">ClearPulse</span>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    <BrandMark alt="" className="h-3 w-3" />
                    Private workspace
                  </span>
                </div>
              </Link>
            )}
            {sidebarCollapsed && (
              <div className="flex min-w-0 flex-1 justify-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href="/dashboard"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] shadow-[0_12px_28px_rgba(37,99,235,0.26)]"
                    >
                      <BrandMark className="h-11 w-11" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    ClearPulse
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 rounded-2xl text-slate-500 lg:flex"
              onClick={toggleSidebar}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-2xl text-slate-500 lg:hidden"
              onClick={() => setSidebarMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-6">
              {navGroups.map((group) => (
                <div key={group.label} className="space-y-2">
                  {!sidebarCollapsed && (
                    <p className="px-3 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                      {group.label}
                    </p>
                  )}
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href || pathname.startsWith(item.href + "/");

                    const linkContent = (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-[22px] px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          sidebarCollapsed && "justify-center px-0",
                          isActive
                            ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.92))] text-slate-950 shadow-[0_14px_28px_rgba(37,99,235,0.14)]"
                            : "text-slate-500 hover:bg-white/75 hover:text-slate-950"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            isActive ? "text-blue-600" : "text-slate-400"
                          )}
                        />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );

                    if (sidebarCollapsed) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                          <TooltipContent side="right" className="font-medium">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return linkContent;
                  })}
                </div>
              ))}
            </div>
          </nav>

          <div className="p-3">
            {!sidebarCollapsed && (
              <div className="rounded-[26px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(239,246,255,0.88))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f172a,#2563eb)] text-xs font-semibold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {currentUser?.name ?? currentUser?.email ?? "User"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{role}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-[20px] border border-white/80 bg-white/70 px-3 py-3 text-xs text-slate-600">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="font-medium text-slate-900">{workspaceName}</p>
                    <p className="mt-1 leading-5">
                      Org data, credentials, and audit records stay tenant-scoped.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="flex justify-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f172a,#2563eb)] text-xs font-semibold text-white">
                      {initials}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {workspaceName}
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

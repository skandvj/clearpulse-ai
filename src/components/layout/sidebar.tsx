"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { getNavItemsForRole } from "@/lib/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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
  const { data: session } = useSession();
  const { sidebarCollapsed, toggleSidebar, sidebarMobileOpen, setSidebarMobileOpen } =
    useAppStore();

  const role = (session?.user?.role as Role) ?? "VIEWER";
  const navGroups = getNavGroups(role);
  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : session?.user?.email?.slice(0, 2).toUpperCase() ?? "CP";

  return (
    <>
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-slate-900/80 bg-[#111317] text-white transition-all duration-300",
          sidebarCollapsed ? "w-[76px]" : "w-[248px]",
          "lg:relative",
          sidebarMobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-3 px-4">
          {!sidebarCollapsed && (
            <Link
              href="/dashboard"
              className="flex min-w-0 flex-1 items-center gap-3 text-[15px] font-semibold tracking-tight text-white"
            >
              <Image
                src="/favicon.ico"
                alt=""
                width={28}
                height={28}
                className="h-8 w-8 shrink-0 rounded-xl"
                unoptimized
              />
              <div className="min-w-0">
                <span className="block truncate">ClearPulse</span>
                <span className="block text-[11px] font-medium text-slate-500">
                  Account intelligence
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
                    className="flex h-7 w-7 shrink-0 items-center justify-center"
                  >
                    <Image
                      src="/favicon.ico"
                      alt="ClearPulse"
                      width={28}
                      height={28}
                      className="h-8 w-8 rounded-xl"
                      unoptimized
                    />
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
            className="hidden h-8 w-8 rounded-xl text-slate-500 hover:bg-white/5 hover:text-white lg:flex"
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
            className="h-8 w-8 rounded-xl text-slate-500 hover:bg-white/5 hover:text-white lg:hidden"
            onClick={() => setSidebarMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.label} className="space-y-1.5">
                {!sidebarCollapsed && (
                  <p className="px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
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
                        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
                        sidebarCollapsed && "justify-center px-0",
                        isActive
                          ? "bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          isActive ? "text-slate-900" : "text-slate-500"
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

        <div className="border-t border-white/5 p-3">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-900">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {session?.user?.name ?? session?.user?.email ?? "User"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{role}</p>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="flex justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-900">
                    {initials}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {session?.user?.name ?? session?.user?.email ?? "User"}
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

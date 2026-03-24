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

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { sidebarCollapsed, toggleSidebar, sidebarMobileOpen, setSidebarMobileOpen } =
    useAppStore();

  const role = (session?.user?.role as Role) ?? "VIEWER";
  const navItems = getNavItemsForRole(role);

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
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-gray-800 bg-[#0D1117] text-white transition-all duration-300",
          sidebarCollapsed ? "w-[68px]" : "w-[240px]",
          "lg:relative",
          sidebarMobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 px-4">
          {!sidebarCollapsed && (
            <Link
              href="/dashboard"
              className="flex min-w-0 flex-1 items-center gap-2.5 font-display text-lg font-bold tracking-tight text-white"
            >
              <Image
                src="/favicon.ico"
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 rounded-md"
                unoptimized
              />
              <span className="truncate">ClearPulse</span>
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
                      className="h-7 w-7 rounded-md"
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
            className="hidden h-7 w-7 text-gray-400 hover:bg-gray-800 hover:text-white lg:flex"
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
            className="h-7 w-7 text-gray-400 hover:bg-gray-800 hover:text-white lg:hidden"
            onClick={() => setSidebarMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600/15 text-blue-400"
                    : "text-gray-400 hover:bg-gray-800/60 hover:text-white"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive ? "text-blue-400" : "text-gray-500"
                  )}
                />
                {!sidebarCollapsed && <span>{item.label}</span>}
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
        </nav>

        <div className="border-t border-gray-800 p-3">
          {!sidebarCollapsed && (
            <div className="rounded-lg bg-gray-800/50 px-3 py-2.5">
              <p className="text-xs font-medium text-gray-400">Signed in as</p>
              <p className="truncate text-sm font-medium text-white">
                {session?.user?.name ?? session?.user?.email ?? "User"}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {role}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

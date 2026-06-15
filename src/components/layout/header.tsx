"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { BrandMark } from "@/components/brand/brand-mark";
import { useCurrentUser } from "@/components/providers/current-user-provider";
import { useAppStore } from "@/stores/app-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Menu, ShieldCheck } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";

export function Header() {
  const currentUser = useCurrentUser();
  const { setSidebarMobileOpen } = useAppStore();

  const initials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : currentUser?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-30 px-4 pt-4 lg:px-8">
      <div className="glass-panel flex h-16 items-center gap-4 rounded-[30px] px-4 lg:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-2xl lg:hidden"
          onClick={() => setSidebarMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Breadcrumbs />

        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden items-center gap-3 rounded-full border border-white/70 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-600 xl:flex">
            <BrandMark className="h-8 w-8" />
            <div>
              <p className="font-medium text-slate-900">
                {currentUser?.organizationName ?? "Workspace"}
              </p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Isolated tenant
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700 md:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            Protected
          </div>
          <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
            <Link href="/support">Support</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full p-0"
              >
                <Avatar className="h-10 w-10 ring-2 ring-white/80">
                  <AvatarImage
                    src={currentUser?.image ?? undefined}
                    alt={currentUser?.name ?? "User"}
                  />
                  <AvatarFallback className="bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] text-xs font-semibold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="glass-panel w-64 rounded-[24px] p-2"
            >
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-slate-900">
                  {currentUser?.name ?? "User"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentUser?.email}
                </p>
                <div className="mt-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Workspace
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {currentUser?.organizationName ?? "Workspace"}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 rounded-2xl text-red-600 focus:text-red-600"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

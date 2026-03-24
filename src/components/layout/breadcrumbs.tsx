"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

interface BreadcrumbSegment {
  label: string;
  href: string;
}

const LABEL_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  accounts: "Accounts",
  admin: "Admin",
  users: "Users",
  integrations: "Integrations",
  sync: "Sync Console",
  audit: "Audit Log",
  kpis: "KPIs",
  meetings: "Meetings",
  signals: "Signals",
  edit: "Edit",
};

function buildBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: BreadcrumbSegment[] = [];

  let path = "";
  for (const segment of segments) {
    path += `/${segment}`;
    const label = LABEL_MAP[segment] ?? decodeURIComponent(segment);
    crumbs.push({ label, href: path });
  }

  return crumbs;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname);

  if (crumbs.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Home className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">
          {crumbs[0]?.label ?? "Home"}
        </span>
      </div>
    );
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <Fragment key={crumb.href}>
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {isLast ? (
              <span className="font-medium text-foreground">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {crumb.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

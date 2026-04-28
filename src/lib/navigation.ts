import {
  LayoutDashboard,
  Building2,
  Users,
  Plug,
  RefreshCw,
  ClipboardList,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { Role } from "@prisma/client";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "LEADERSHIP", "CSM", "VIEWER"],
  },
  {
    label: "Accounts",
    href: "/accounts",
    icon: Building2,
    roles: ["ADMIN", "LEADERSHIP", "CSM", "VIEWER"],
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    label: "Integrations",
    href: "/admin/integrations",
    icon: Plug,
    roles: ["ADMIN"],
  },
  {
    label: "Sync Console",
    href: "/admin/sync",
    icon: RefreshCw,
    roles: ["ADMIN"],
  },
  {
    label: "Audit Log",
    href: "/admin/audit",
    icon: ClipboardList,
    roles: ["ADMIN"],
  },
  {
    label: "KPI Framework",
    href: "/admin/kpi-framework",
    icon: SlidersHorizontal,
    roles: ["ADMIN"],
  },
];

export function getNavItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

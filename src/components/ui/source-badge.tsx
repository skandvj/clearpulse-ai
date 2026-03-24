"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Hash,
  Video,
  Calendar,
  Activity,
  Cloud,
  Users,
  FolderOpen,
  Bug,
  FileText,
  type LucideIcon,
} from "lucide-react";

type SignalSource =
  | "SLACK"
  | "FATHOM"
  | "AM_MEETING"
  | "VITALLY"
  | "SALESFORCE"
  | "PERSONAS"
  | "SHAREPOINT"
  | "JIRA"
  | "GOOGLE_DRIVE";

interface SourceConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: LucideIcon;
}

const SOURCE_CONFIG: Record<SignalSource, SourceConfig> = {
  SLACK: {
    label: "Slack",
    color: "text-[#4A154B]",
    bgColor: "bg-[#4A154B]/10",
    borderColor: "border-[#4A154B]/20",
    icon: Hash,
  },
  FATHOM: {
    label: "Fathom",
    color: "text-[#FF6B35]",
    bgColor: "bg-[#FF6B35]/10",
    borderColor: "border-[#FF6B35]/20",
    icon: Video,
  },
  AM_MEETING: {
    label: "AM Meeting",
    color: "text-[#8B5CF6]",
    bgColor: "bg-[#8B5CF6]/10",
    borderColor: "border-[#8B5CF6]/20",
    icon: Calendar,
  },
  VITALLY: {
    label: "Vitally",
    color: "text-[#7C3AED]",
    bgColor: "bg-[#7C3AED]/10",
    borderColor: "border-[#7C3AED]/20",
    icon: Activity,
  },
  SALESFORCE: {
    label: "Salesforce",
    color: "text-[#00A1E0]",
    bgColor: "bg-[#00A1E0]/10",
    borderColor: "border-[#00A1E0]/20",
    icon: Cloud,
  },
  PERSONAS: {
    label: "Personas",
    color: "text-[#059669]",
    bgColor: "bg-[#059669]/10",
    borderColor: "border-[#059669]/20",
    icon: Users,
  },
  SHAREPOINT: {
    label: "SharePoint",
    color: "text-[#0078D4]",
    bgColor: "bg-[#0078D4]/10",
    borderColor: "border-[#0078D4]/20",
    icon: FolderOpen,
  },
  JIRA: {
    label: "Jira",
    color: "text-[#0052CC]",
    bgColor: "bg-[#0052CC]/10",
    borderColor: "border-[#0052CC]/20",
    icon: Bug,
  },
  GOOGLE_DRIVE: {
    label: "Google Drive",
    color: "text-[#4285F4]",
    bgColor: "bg-[#4285F4]/10",
    borderColor: "border-[#4285F4]/20",
    icon: FileText,
  },
};

interface SourceBadgeProps {
  source: SignalSource;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function SourceBadge({
  source,
  showIcon = true,
  size = "sm",
  className,
}: SourceBadgeProps) {
  const config = SOURCE_CONFIG[source];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium",
        config.bgColor,
        config.color,
        config.borderColor,
        size === "sm" ? "text-xs" : "text-sm",
        className
      )}
    >
      {showIcon && (
        <Icon className={cn("shrink-0", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      )}
      {config.label}
    </Badge>
  );
}

export function getSourceConfig(source: SignalSource): SourceConfig {
  return SOURCE_CONFIG[source];
}

export { type SignalSource };

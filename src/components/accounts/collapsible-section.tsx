"use client";

import { useState, type ReactNode } from "react";
import { type LucideIcon, ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  children: ReactNode;
  badge?: ReactNode;
}

export function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="rounded-3xl border-slate-200 shadow-none">
      <CardHeader
        className="cursor-pointer select-none px-6 pb-4 pt-5"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {Icon ? <Icon className="h-4 w-4 text-slate-400" /> : null}
            <CardTitle className="text-[15px] font-semibold text-slate-900">
              {title}
            </CardTitle>
            {badge}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-400 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </CardHeader>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <CardContent className="px-6 pb-6 pt-0">{children}</CardContent>
      </div>
    </Card>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useUpdateKPI } from "@/lib/hooks/use-kpis";
import type { KPI } from "@/components/accounts/account-overview";

const KPI_CATEGORIES = [
  "DEFLECTION",
  "EFFICIENCY",
  "ADOPTION",
  "REVENUE",
  "SATISFACTION",
  "RETENTION",
  "CUSTOM",
] as const;

const KPI_STATUSES = ["ON_TRACK", "AT_RISK", "ACHIEVED", "MISSED"] as const;

const editKPISchema = z.object({
  metricName: z.string().min(1, "Metric name is required").max(255),
  category: z.enum(KPI_CATEGORIES),
  targetValue: z.string().optional(),
  currentValue: z.string().optional(),
  unit: z.string().max(50).optional(),
  status: z.enum(KPI_STATUSES),
  notes: z.string().optional(),
});

type EditKPIFormValues = z.infer<typeof editKPISchema>;

interface EditKPIDialogProps {
  accountId: string;
  kpi: KPI;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditKPIDialog({
  accountId,
  kpi,
  open,
  onOpenChange,
}: EditKPIDialogProps) {
  const updateKPI = useUpdateKPI(accountId, kpi.id);

  const form = useForm<EditKPIFormValues>({
    resolver: zodResolver(editKPISchema),
    defaultValues: {
      metricName: kpi.metricName,
      category: kpi.category as EditKPIFormValues["category"],
      targetValue: kpi.targetValue ?? "",
      currentValue: kpi.currentValue ?? "",
      unit: kpi.unit ?? "",
      status: (kpi.status as EditKPIFormValues["status"]) ?? "ON_TRACK",
      notes: kpi.notes ?? "",
    },
  });

  const onSubmit = async (values: EditKPIFormValues) => {
    await updateKPI.mutateAsync(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit KPI</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-metricName">Metric Name *</Label>
            <Input
              id="edit-metricName"
              {...form.register("metricName")}
            />
            {form.formState.errors.metricName && (
              <p className="text-xs text-destructive">
                {form.formState.errors.metricName.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.watch("category")}
                onValueChange={(val) =>
                  form.setValue(
                    "category",
                    val as EditKPIFormValues["category"]
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KPI_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(val) =>
                  form.setValue("status", val as EditKPIFormValues["status"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KPI_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-targetValue">Target Value</Label>
              <Input
                id="edit-targetValue"
                {...form.register("targetValue")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-currentValue">Current Value</Label>
              <Input
                id="edit-currentValue"
                {...form.register("currentValue")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-unit">Unit</Label>
            <Input id="edit-unit" {...form.register("unit")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              rows={3}
              {...form.register("notes")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateKPI.isPending}
              className="gap-1.5"
            >
              {updateKPI.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

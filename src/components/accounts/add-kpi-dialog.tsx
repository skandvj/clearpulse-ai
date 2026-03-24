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
import { useCreateKPI } from "@/lib/hooks/use-kpis";

const KPI_CATEGORIES = [
  "DEFLECTION",
  "EFFICIENCY",
  "ADOPTION",
  "REVENUE",
  "SATISFACTION",
  "RETENTION",
  "CUSTOM",
] as const;

const addKPISchema = z.object({
  metricName: z.string().min(1, "Metric name is required").max(255),
  category: z.enum(KPI_CATEGORIES),
  targetValue: z.string().optional(),
  currentValue: z.string().optional(),
  unit: z.string().max(50).optional(),
  notes: z.string().optional(),
});

type AddKPIFormValues = z.infer<typeof addKPISchema>;

interface AddKPIDialogProps {
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddKPIDialog({
  accountId,
  open,
  onOpenChange,
}: AddKPIDialogProps) {
  const createKPI = useCreateKPI(accountId);

  const form = useForm<AddKPIFormValues>({
    resolver: zodResolver(addKPISchema),
    defaultValues: {
      metricName: "",
      category: "CUSTOM",
      targetValue: "",
      currentValue: "",
      unit: "",
      notes: "",
    },
  });

  const onSubmit = async (values: AddKPIFormValues) => {
    await createKPI.mutateAsync(values);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add KPI</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metricName">Metric Name *</Label>
            <Input
              id="metricName"
              placeholder="e.g. Ticket Deflection Rate"
              {...form.register("metricName")}
            />
            {form.formState.errors.metricName && (
              <p className="text-xs text-destructive">
                {form.formState.errors.metricName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={form.watch("category")}
              onValueChange={(val) =>
                form.setValue("category", val as AddKPIFormValues["category"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="targetValue">Target Value</Label>
              <Input
                id="targetValue"
                placeholder="e.g. 80%"
                {...form.register("targetValue")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentValue">Current Value</Label>
              <Input
                id="currentValue"
                placeholder="e.g. 65%"
                {...form.register("currentValue")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input
              id="unit"
              placeholder="e.g. %, tickets, hours"
              {...form.register("unit")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional context..."
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
              disabled={createKPI.isPending}
              className="gap-1.5"
            >
              {createKPI.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Create KPI
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

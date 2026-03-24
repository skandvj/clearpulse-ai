"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateAccount, type Tier } from "@/lib/hooks/use-accounts";
import { Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Account name is required").max(120),
  domain: z.string().max(255).optional().or(z.literal("")),
  tier: z.enum(["ENTERPRISE", "GROWTH", "STARTER"]).optional(),
  industry: z.string().max(120).optional().or(z.literal("")),
  csmId: z.string().max(60).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAccountDialog({
  open,
  onOpenChange,
}: AddAccountDialogProps) {
  const createAccount = useCreateAccount();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      domain: "",
      tier: undefined,
      industry: "",
      csmId: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createAccount.mutateAsync({
        name: values.name,
        domain: values.domain || undefined,
        tier: values.tier as Tier | undefined,
        industry: values.industry || undefined,
        csmId: values.csmId || undefined,
      });
      toast.success("Account created successfully");
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create account"
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
          <DialogDescription>
            Create a new client account to track KPIs and health.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Acme Corp"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              placeholder="acme.com"
              {...register("domain")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tier">Tier</Label>
            <Select
              onValueChange={(val) =>
                setValue("tier", val as FormValues["tier"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="tier">
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                <SelectItem value="GROWTH">Growth</SelectItem>
                <SelectItem value="STARTER">Starter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              placeholder="SaaS, Fintech, Healthcare…"
              {...register("industry")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="csmId">CSM ID</Label>
            <Input
              id="csmId"
              placeholder="User ID of assigned CSM"
              {...register("csmId")}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createAccount.isPending}>
              {createAccount.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

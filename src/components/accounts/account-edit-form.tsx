"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAccount,
  useUpdateAccount,
  type Tier,
} from "@/lib/hooks/use-accounts";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/rbac";

const editAccountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(255),
  domain: z.string().max(255),
  tier: z.enum(["ENTERPRISE", "GROWTH", "STARTER"]).nullable(),
  industry: z.string().max(100),
  csmId: z.string().max(255),
  currentSolution: z.string(),
  currentState: z.string(),
  businessGoals: z.string(),
  objectives: z.string(),
  implementationPlan: z.string(),
  roadblocks: z.string(),
});

type EditAccountFormValues = z.infer<typeof editAccountSchema>;

interface AccountEditData {
  id: string;
  name: string;
  domain: string | null;
  tier: Tier | null;
  industry: string | null;
  csmId: string | null;
  currentSolution: string | null;
  currentState: string | null;
  businessGoals: string | null;
  objectives: string | null;
  implementationPlan: string | null;
  roadblocks: string | null;
}

interface AccountEditFormProps {
  accountId: string;
}

export function AccountEditForm({ accountId }: AccountEditFormProps) {
  const router = useRouter();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const canEdit = can(PERMISSIONS.EDIT_ACCOUNT_FIELDS);
  const { data: account, isLoading, error } = useAccount<AccountEditData>(accountId);
  const updateAccount = useUpdateAccount(accountId);

  const form = useForm<EditAccountFormValues>({
    resolver: zodResolver(editAccountSchema),
    defaultValues: {
      name: "",
      domain: "",
      tier: null,
      industry: "",
      csmId: "",
      currentSolution: "",
      currentState: "",
      businessGoals: "",
      objectives: "",
      implementationPlan: "",
      roadblocks: "",
    },
  });

  useEffect(() => {
    if (!account) return;

    form.reset({
      name: account.name,
      domain: account.domain ?? "",
      tier: account.tier ?? null,
      industry: account.industry ?? "",
      csmId: account.csmId ?? "",
      currentSolution: account.currentSolution ?? "",
      currentState: account.currentState ?? "",
      businessGoals: account.businessGoals ?? "",
      objectives: account.objectives ?? "",
      implementationPlan: account.implementationPlan ?? "",
      roadblocks: account.roadblocks ?? "",
    });
  }, [account, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    await updateAccount.mutateAsync({
      name: values.name,
      domain: values.domain,
      tier: values.tier,
      industry: values.industry,
      csmId: values.csmId ? values.csmId : null,
      currentSolution: values.currentSolution,
      currentState: values.currentState,
      businessGoals: values.businessGoals,
      objectives: values.objectives,
      implementationPlan: values.implementationPlan,
      roadblocks: values.roadblocks,
    });

    router.push(`/accounts/${accountId}`);
    router.refresh();
  });

  if (isLoading || permissionsLoading) {
    return <AccountEditSkeleton />;
  }

  if (error || !account) {
    return (
      <MessageState
        title="Unable to load account"
        description={error?.message ?? "This account could not be loaded."}
        accountId={accountId}
      />
    );
  }

  if (!canEdit) {
    return (
      <MessageState
        title="You do not have permission to edit this account"
        description="Ask an administrator if you need edit access."
        accountId={accountId}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
            Edit Account
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Update account metadata and overview sections for {account.name}.
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => router.push(`/accounts/${accountId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Account
        </Button>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Account Metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Account Name</Label>
              <Input id="name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" placeholder="acme.com" {...form.register("domain")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" placeholder="SaaS" {...form.register("industry")} />
            </div>

            <div className="space-y-2">
              <Label>Tier</Label>
              <Select
                value={form.watch("tier") ?? "NONE"}
                onValueChange={(value) =>
                  form.setValue(
                    "tier",
                    value === "NONE" ? null : (value as Tier),
                    { shouldDirty: true, shouldValidate: true }
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No tier</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  <SelectItem value="GROWTH">Growth</SelectItem>
                  <SelectItem value="STARTER">Starter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="csmId">Assigned CSM ID</Label>
              <Input
                id="csmId"
                placeholder="User ID of assigned CSM"
                {...form.register("csmId")}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Account Overview Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentSolution">Current Agreement / Solution Summary</Label>
              <Textarea id="currentSolution" rows={4} {...form.register("currentSolution")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentState">Current State</Label>
              <Textarea id="currentState" rows={4} {...form.register("currentState")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessGoals">Business Goals</Label>
              <Textarea id="businessGoals" rows={4} {...form.register("businessGoals")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objectives">Objectives</Label>
              <Textarea id="objectives" rows={4} {...form.register("objectives")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="implementationPlan">Implementation Plan</Label>
              <Textarea
                id="implementationPlan"
                rows={4}
                {...form.register("implementationPlan")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="roadblocks">Roadblocks</Label>
              <Textarea id="roadblocks" rows={4} {...form.register("roadblocks")} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/accounts/${accountId}`)}
          >
            Cancel
          </Button>
          <Button type="submit" className="gap-2" disabled={updateAccount.isPending}>
            {updateAccount.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Account
          </Button>
        </div>
      </form>
    </div>
  );
}

function MessageState({
  title,
  description,
  accountId,
}: {
  title: string;
  description: string;
  accountId: string;
}) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => router.push(`/accounts/${accountId}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Account
      </Button>
      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardContent className="p-6">
          <p className="font-medium text-gray-900">{title}</p>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountEditSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <Skeleton className="h-10 sm:col-span-2" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardContent className="space-y-4 p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

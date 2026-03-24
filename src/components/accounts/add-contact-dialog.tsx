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
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useCreateContact } from "@/lib/hooks/use-contacts";

const addContactSchema = z.object({
  name: z.string().min(1, "Contact name is required").max(255),
  role: z.string().max(255).optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  isPrimary: z.boolean().optional(),
});

type AddContactFormValues = z.infer<typeof addContactSchema>;

interface AddContactDialogProps {
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddContactDialog({
  accountId,
  open,
  onOpenChange,
}: AddContactDialogProps) {
  const createContact = useCreateContact(accountId);

  const form = useForm<AddContactFormValues>({
    resolver: zodResolver(addContactSchema),
    defaultValues: {
      name: "",
      role: "",
      email: "",
      isPrimary: false,
    },
  });

  const onSubmit = async (values: AddContactFormValues) => {
    const payload = {
      ...values,
      email: values.email || undefined,
    };
    await createContact.mutateAsync(payload);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name *</Label>
            <Input
              id="contact-name"
              placeholder="Full name"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-role">Role</Label>
            <Input
              id="contact-role"
              placeholder="e.g. VP of Engineering"
              {...form.register("role")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="email@company.com"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="contact-primary"
              checked={form.watch("isPrimary")}
              onCheckedChange={(checked) =>
                form.setValue("isPrimary", checked)
              }
            />
            <Label htmlFor="contact-primary" className="cursor-pointer">
              Primary contact
            </Label>
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
              disabled={createContact.isPending}
              className="gap-1.5"
            >
              {createContact.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Add Contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { useDeleteContact } from "@/lib/hooks/use-contacts";
import { AddContactDialog } from "./add-contact-dialog";
import type { Contact } from "./account-overview";

interface ContactsGridProps {
  accountId: string;
  contacts: Contact[];
  canEdit: boolean;
}

export function ContactsGrid({
  accountId,
  contacts,
  canEdit,
}: ContactsGridProps) {
  const [addOpen, setAddOpen] = useState(false);
  const deleteContact = useDeleteContact(accountId);

  const handleDelete = (contactId: string, name: string) => {
    if (!confirm(`Delete contact "${name}"?`)) return;
    deleteContact.mutate(contactId);
  };

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            Add contact
          </Button>
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No contacts added yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {contacts.map((contact) => (
            <Card
              key={contact.id}
              className="rounded-2xl border-slate-200 shadow-none"
            >
              <CardContent className="flex items-start justify-between p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-slate-900">{contact.name}</p>
                    {contact.isPrimary && (
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-slate-50 text-[10px] leading-tight text-slate-600"
                      >
                        Primary
                      </Badge>
                    )}
                  </div>
                  {contact.role && (
                    <p className="truncate text-sm text-slate-500">
                      {contact.role}
                    </p>
                  )}
                  {contact.email && (
                    <p className="truncate text-sm text-slate-500">
                      {contact.email}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="ml-2 flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      onClick={() => handleDelete(contact.id, contact.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddContactDialog
        accountId={accountId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </div>
  );
}

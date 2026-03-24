"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, Mail, Star } from "lucide-react";
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
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No contacts added yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {contacts.map((contact) => (
            <Card
              key={contact.id}
              className="rounded-xl border-gray-100 shadow-sm"
            >
              <CardContent className="flex items-start justify-between p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{contact.name}</p>
                    {contact.isPrimary && (
                      <Badge
                        variant="default"
                        className="gap-1 text-[10px] leading-tight"
                      >
                        <Star className="h-2.5 w-2.5" />
                        Primary
                      </Badge>
                    )}
                  </div>
                  {contact.role && (
                    <p className="truncate text-sm text-muted-foreground">
                      {contact.role}
                    </p>
                  )}
                  {contact.email && (
                    <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      {contact.email}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="ml-2 flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled
                      title="Edit (coming soon)"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
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

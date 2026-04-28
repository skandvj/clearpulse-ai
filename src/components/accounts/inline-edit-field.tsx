"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InlineEditFieldProps {
  value: string | null;
  onSave: (newValue: string) => Promise<void>;
  canEdit: boolean;
  placeholder?: string;
  multiline?: boolean;
}

export function InlineEditField({
  value,
  onSave,
  canEdit,
  placeholder = "No content yet",
  multiline = true,
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = () => {
    setDraft(value ?? "");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft(value ?? "");
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(draft);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    const InputComponent = multiline ? Textarea : Input;
    return (
      <div className="space-y-2">
        <InputComponent
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          rows={multiline ? 4 : undefined}
          className="resize-none"
          disabled={isSaving}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3">
      <p
        className={cn(
          "flex-1 whitespace-pre-wrap text-sm leading-relaxed",
          value ? "text-slate-700" : "text-slate-400"
        )}
      >
        {value || placeholder}
      </p>
      {canEdit && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2 text-xs text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
          onClick={handleEdit}
        >
          Edit
        </Button>
      )}
    </div>
  );
}

const PRIORITY_NOTE_AUTHOR_MARKERS = [
  "account team",
  "csm team",
  "customer success team",
];

export const PRIORITY_NOTE_LABEL = "Account team note";

export function isPriorityNoteAuthor(author: string | null): boolean {
  const normalized = (author ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return PRIORITY_NOTE_AUTHOR_MARKERS.some((marker) =>
    normalized.includes(marker)
  );
}

import type { Document } from '../services/documentService';

export interface DocumentGroup {
  label: string;
  documents: Document[];
}

const DAY = 24 * 60 * 60 * 1000;

/** Splits documents (newest first) into "Today", "Within 7 days", "Within 30 days" and "Older", by when they were last changed. Empty groups are left out. */
export function groupByAge(documents: Document[], now: Date = new Date()): DocumentGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups: DocumentGroup[] = [
    { label: 'Today', documents: [] },
    { label: 'Within 7 days', documents: [] },
    { label: 'Within 30 days', documents: [] },
    { label: 'Older', documents: [] },
  ];
  for (const doc of documents) {
    const changed = new Date(doc.updatedAt).getTime();
    const index = changed >= startOfToday ? 0 : now.getTime() - changed <= 7 * DAY ? 1 : now.getTime() - changed <= 30 * DAY ? 2 : 3;
    groups[index]!.documents.push(doc);
  }
  return groups.filter((g) => g.documents.length > 0);
}

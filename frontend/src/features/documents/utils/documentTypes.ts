import { FileSpreadsheet, FileText, FileType2, type LucideIcon } from 'lucide-react';
import type { DocumentType } from 'shared';

export interface DocumentKind {
  type: DocumentType;
  /** Tab and heading name */
  label: string;
  singular: string;
  extension: string;
  /** What the "upload" picker accepts */
  accept: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon's tinted square */
  tint: string;
  /** What a new document starts as */
  newHint: string;
}

export const DOCUMENT_KINDS: DocumentKind[] = [
  { type: 'PDF', label: 'PDF', singular: 'PDF', extension: 'pdf', accept: '.pdf,application/pdf', icon: FileType2, tint: 'bg-red-100 text-red-700', newHint: 'Start from some text, or leave it empty for a blank page.' },
  { type: 'WORD', label: 'Word', singular: 'Word document', extension: 'docx', accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', icon: FileText, tint: 'bg-blue-100 text-blue-700', newHint: 'A blank document you can write in.' },
  { type: 'EXCEL', label: 'Excel', singular: 'spreadsheet', extension: 'xlsx', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', icon: FileSpreadsheet, tint: 'bg-emerald-100 text-emerald-700', newHint: 'A blank spreadsheet.' },
];

export const kindOf = (type: DocumentType): DocumentKind => DOCUMENT_KINDS.find((k) => k.type === type)!;

/** Where a document opens for editing. */
export const editorPath = (type: DocumentType, id: string) => `/documents/${type.toLowerCase()}/${id}`;

/** 1536 -> "1.5 KB" */
export function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** The page listing one kind of document, the recent ones (no argument) or the starred ones. */
export const listPath = (type?: DocumentType | 'starred') => (type ? `/documents/${type.toLowerCase()}` : '/documents');

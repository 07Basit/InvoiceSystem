import { z } from 'zod';
import { lineItemSchema } from './invoice.schema';

/** What is sent to apply a checked Excel update: the lines read from the file, and the invoice version they were checked against. */
export const excelUpdateApplySchema = z.object({
  lines: z.array(lineItemSchema).min(1, 'At least one line item is required').max(500),
  /** For an invoice with a Party and a Custom page: the lines of the Custom page (the `lines` above are the Party page's) */
  customLines: z.array(lineItemSchema).min(1, 'At least one line item is required').max(500).optional(),
  /** The invoice's version when the file was checked; if the invoice has changed since, nothing is applied */
  invoiceVersion: z.string().min(1),
  fileName: z.string().trim().max(260).optional(),
});
export type ExcelUpdateApplyDto = z.infer<typeof excelUpdateApplySchema>;

// ---- what the server sends back

export type ExcelLineStatus = 'unchanged' | 'changed' | 'added';

export interface ExcelLineChange {
  field: 'marksAndNos' | 'containerNo' | 'descriptionOfGoods' | 'netWeightPerPackage' | 'numberOfBoxes' | 'ratePerKg';
  label: string;
  before: string;
  after: string;
}

export interface ExcelPreviewLine {
  /** The row in the Excel sheet */
  row: number;
  status: ExcelLineStatus;
  /** The saved line it matches; none for an added line */
  id: string | null;
  input: { id?: string; marksAndNos?: string; containerNo?: string; descriptionOfGoods: string; netWeightPerPackage: number; numberOfBoxes: number; ratePerKg: number };
  totalNetWeight: number;
  totalPerBox: number;
  amount: number;
  changes: ExcelLineChange[];
  /** Why the row cannot be used yet (empty when it is fine) */
  problems: string[];
}

export interface ExcelRemovedLine {
  id: string;
  descriptionOfGoods: string;
  numberOfBoxes: number;
  amount: number;
}

export interface ExcelTotals {
  boxes: number;
  netWeight: number;
  subTotal: number;
  total: number;
}

/** One page of an invoice: its lines, what is removed, the totals and the counts. A Party + Custom invoice has two. */
export interface ExcelPagePreview {
  lines: ExcelPreviewLine[];
  removed: ExcelRemovedLine[];
  totals: { before: ExcelTotals; after: ExcelTotals };
  counts: { added: number; removed: number; changed: number; unchanged: number };
}

export interface ExcelUpdatePreview {
  invoiceId: string;
  invoiceNumber: string;
  currency: string;
  fileName: string;
  /** The invoice's version now: sent back when the update is applied */
  invoiceVersion: string;
  /** The invoice was changed in the app after this file was downloaded */
  fileIsOlder: boolean;
  /** The invoice itself: for a Party + Custom invoice, its Party page */
  lines: ExcelPreviewLine[];
  removed: ExcelRemovedLine[];
  totals: { before: ExcelTotals; after: ExcelTotals };
  /** For a Party + Custom invoice: the Custom page (otherwise null) */
  custom: ExcelPagePreview | null;
  /** For an actual invoice: payments already recorded, and the balance before and after */
  payments: { paid: number; balanceBefore: number; balanceAfter: number } | null;
  /** The counts of the invoice itself (for a Party + Custom invoice, of its Party page) */
  counts: { added: number; removed: number; changed: number; unchanged: number };
  warnings: string[];
  /** Reasons the update cannot be applied yet, other than a problem in one row */
  blockers: string[];
  /** Whether the update can be applied: not while a row has a problem, or when nothing changed */
  canApply: boolean;
}

/** The latest update made from Excel, shown on the invoice with an Undo while it is still possible. */
export interface ExcelUpdateRecord {
  id: string;
  fileName: string | null;
  createdAt: string;
  added: number;
  removed: number;
  changed: number;
  canUndo: boolean;
}

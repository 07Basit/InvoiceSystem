import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-26');
const optionalText = (max: number) => z.string().trim().max(max).optional();

/** The ways a payment is offered to start with. Any other method that is typed is remembered and offered after that. */
export const PAYMENT_METHODS = ['Bank transfer', 'Cheque', 'Cash', 'Card', 'UPI'] as const;

/** The method a new payment starts with. */
export const DEFAULT_PAYMENT_METHOD = PAYMENT_METHODS[0];

/** A payment received against an actual invoice, in that invoice's currency. */
export const paymentSchema = z.object({
  paidOn: isoDate,
  amount: z.number({ invalid_type_error: 'Amount must be a number', required_error: 'Amount is required' }).positive('Amount must be more than zero').max(99_999_999_999, 'Amount is too large'),
  method: optionalText(40),
  reference: optionalText(120),
  notes: optionalText(500),
});
export type PaymentDto = z.infer<typeof paymentSchema>;

export const statementQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type StatementQuery = z.infer<typeof statementQuerySchema>;

// ---- what the server sends back

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';

/** How much of an invoice has been paid (invoice currency). */
export interface PaymentSummary {
  total: number;
  paid: number;
  /** What is still due; negative when more than the total was received */
  balance: number;
  status: PaymentStatus;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  paidOn: string;
  amount: number;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface InvoicePayments {
  invoiceId: string;
  currency: string;
  payments: PaymentRecord[];
  summary: PaymentSummary;
}

export interface StatementRow {
  date: string;
  kind: 'invoice' | 'payment';
  /** The invoice number (printed number) the row is about */
  reference: string;
  description: string;
  /** What the importer owes more (an invoice) */
  debit: number;
  /** What the importer paid */
  credit: number;
  balance: number;
}

export interface StatementInvoice {
  invoiceId: string;
  number: string;
  date: string;
  total: number;
  paid: number;
  balance: number;
  status: PaymentStatus;
}

/** One currency of a statement: importers can be billed in more than one. */
export interface StatementSection {
  currency: string;
  opening: number;
  invoiced: number;
  received: number;
  closing: number;
  rows: StatementRow[];
  invoices: StatementInvoice[];
}

export interface Statement {
  importer: { id: string; name: string; address: string | null; contact: string | null; email: string | null };
  from: string | null;
  to: string | null;
  generatedOn: string;
  sections: StatementSection[];
}

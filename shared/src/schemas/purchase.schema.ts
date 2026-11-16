import { z } from 'zod';
import { paginationQuerySchema } from './pagination.schema';

// ---------------------------------------------------------------------------
// Purchase invoices (bought from suppliers such as Mapoose and Sunil)
// ---------------------------------------------------------------------------

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-26');
const amount = (label: string) =>
  z.number({ invalid_type_error: `${label} must be a number`, required_error: `${label} is required` }).min(0, `${label} cannot be negative`).max(99_999_999_999, `${label} is too large`);
const optionalText = (max: number) => z.string().trim().max(max).optional();

/** How far (in rupees) the lines and charges may differ from the totals written on the invoice, for rounding. */
export const PURCHASE_TOTAL_TOLERANCE = 1;

// ---- the import template: how to find things in a supplier's Excel file

/** Invoice-level values a template can point at. */
export const PURCHASE_HEADER_FIELDS = ['invoiceNumber', 'invoiceDate', 'purchaseDate', 'dueDate', 'subTotal', 'taxAmount', 'freight', 'otherCharges', 'total'] as const;
export type PurchaseHeaderField = (typeof PURCHASE_HEADER_FIELDS)[number];

/** Columns of the item table a template can name. */
export const PURCHASE_COLUMNS = ['description', 'quantity', 'netWeight', 'packWeight', 'unit', 'rate', 'packing', 'amount'] as const;
export type PurchaseColumn = (typeof PURCHASE_COLUMNS)[number];

/** Where a value is: written next to a label ("Invoice No."), or in a fixed cell ("F3"). A cell wins over a label. */
export const purchaseFieldSourceSchema = z.object({
  label: optionalText(100),
  cell: z.string().trim().toUpperCase().regex(/^[A-Z]{1,3}[1-9][0-9]{0,4}$/, 'Use a cell like F3').optional(),
});

export const purchaseTemplateSchema = z.object({
  /** The sheet to read; the first one with data when empty */
  sheet: optionalText(100),
  /** The row holding the column titles of the item table; found automatically when empty */
  headerRow: z.number().int().min(1).max(1000).optional(),
  fields: z.record(z.enum(PURCHASE_HEADER_FIELDS), purchaseFieldSourceSchema).optional(),
  /** Each column by its title text (or its letter, like "C") */
  columns: z.record(z.enum(PURCHASE_COLUMNS), z.string().trim().min(1).max(100)).optional(),
  /** Text that marks the end of the item rows, such as "Total" */
  stopAt: optionalText(100),
});
export type PurchaseTemplate = z.infer<typeof purchaseTemplateSchema>;

// ---- suppliers

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required').max(200),
  contact: optionalText(200),
  phone: optionalText(50),
  email: z.string().trim().email('Enter a valid email address').max(200).optional(),
  address: optionalText(500),
  gstin: optionalText(20),
  importTemplate: purchaseTemplateSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});
export type SupplierDto = z.infer<typeof supplierSchema>;

// ---- a purchase invoice

export const purchaseLineSchema = z.object({
  productName: z.string().trim().min(1, 'Product is required').max(200),
  description: optionalText(500),
  quantity: amount('Quantity').optional(),
  netWeight: amount('Net weight').optional(),
  unit: optionalText(20),
  rate: amount('Rate'),
  rateBasis: z.enum(['KG', 'UNIT']).default('KG'),
  amount: amount('Amount'),
});
export type PurchaseLineDto = z.infer<typeof purchaseLineSchema>;

export const purchaseInvoiceSchema = z
  .object({
    supplierId: z.string().min(1, 'Choose the supplier'),
    invoiceNumber: z.string().trim().min(1, 'Invoice number is required').max(100),
    invoiceDate: isoDate,
    purchaseDate: isoDate.optional(),
    dueDate: isoDate.optional(),
    lines: z.array(purchaseLineSchema).min(1, 'Add at least one product').max(500),
    subTotal: amount('Subtotal'),
    taxAmount: amount('GST / tax').default(0),
    freight: amount('Freight').default(0),
    otherCharges: amount('Other charges').default(0),
    total: amount('Total'),
    /** The actual invoice this purchase was made for (optional) */
    invoiceId: z.string().min(1).optional(),
    notes: optionalText(1000),
    sourceFileName: optionalText(260),
    sourceHash: z.string().regex(/^[0-9a-f]{64}$/, 'Not a file fingerprint').optional(),
  })
  .superRefine((p, ctx) => {
    const lines = p.lines.reduce((sum, l) => sum + l.amount, 0);
    if (Math.abs(lines - p.subTotal) > PURCHASE_TOTAL_TOLERANCE) {
      ctx.addIssue({ code: 'custom', path: ['subTotal'], message: `Subtotal (${p.subTotal.toFixed(2)}) does not match the products (${lines.toFixed(2)})` });
    }
    const expected = p.subTotal + p.taxAmount + p.freight + p.otherCharges;
    if (Math.abs(expected - p.total) > PURCHASE_TOTAL_TOLERANCE) {
      ctx.addIssue({ code: 'custom', path: ['total'], message: `Total (${p.total.toFixed(2)}) does not match subtotal + GST + freight + other charges (${expected.toFixed(2)})` });
    }
  });
export type PurchaseInvoiceDto = z.infer<typeof purchaseInvoiceSchema>;

// ---- queries

export const listPurchasesQuerySchema = paginationQuerySchema.extend({
  supplierId: z.string().min(1).optional(),
  invoiceFrom: isoDate.optional(),
  invoiceTo: isoDate.optional(),
  purchaseFrom: isoDate.optional(),
  purchaseTo: isoDate.optional(),
  /** a product name (part of it) bought on the invoice */
  product: z.string().trim().min(1).optional(),
  sort: z.enum(['invoiceDate', 'purchaseDate', 'total', 'invoiceNumber', 'createdAt']).default('invoiceDate'),
});
export type ListPurchasesQuery = z.infer<typeof listPurchasesQuerySchema>;

export const purchaseReportQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  supplierId: z.string().min(1).optional(),
  product: z.string().trim().min(1).optional(),
});
export type PurchaseReportQuery = z.infer<typeof purchaseReportQuerySchema>;

export const priceHistoryQuerySchema = z.object({
  product: z.string().trim().min(1, 'Choose a product'),
  from: isoDate.optional(),
  to: isoDate.optional(),
  supplierId: z.string().min(1).optional(),
});
export type PriceHistoryQuery = z.infer<typeof priceHistoryQuerySchema>;

export const priceOverviewQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  supplierId: z.string().min(1).optional(),
});
export type PriceOverviewQuery = z.infer<typeof priceOverviewQuerySchema>;

// ---- what the server sends back

export interface PurchaseTotals {
  count: number;
  subTotal: number;
  taxAmount: number;
  freight: number;
  otherCharges: number;
  total: number;
}

export interface PurchaseReport {
  from: string | null;
  to: string | null;
  totals: PurchaseTotals;
  bySupplier: (PurchaseTotals & { supplierId: string; supplierName: string })[];
  byProduct: { product: string; lines: number; quantity: number; netWeight: number; amount: number; averageRate: number; minRate: number; maxRate: number }[];
}

/** What the same product was sold for on the actual invoice a purchase was made for. */
export interface PriceSale {
  invoiceId: string;
  invoiceNumber: string;
  currency: string;
  /** The rate per kg on the invoice, in the invoice's own currency */
  rate: number;
  /** The same rate in rupees at the exchange rate of the invoice date; null when no rate is known */
  rateInr: number | null;
  /** Rupees for 1 unit of the invoice currency */
  fxRate: number | null;
}

export interface PricePoint {
  date: string;
  rate: number;
  /** Set when the purchase is connected to an actual invoice that has this product */
  sale: PriceSale | null;
  netWeight: number | null;
  supplierId: string;
  supplierName: string;
  invoiceId: string;
  invoiceNumber: string;
}

export interface PriceHistory {
  product: string;
  points: PricePoint[];
  summary: { latest: number; latestDate: string; previous: number | null; previousDate: string | null; changePercent: number | null; lowest: number; highest: number; average: number } | null;
}

/** One product on the price tracker's overview: where its price stands and how it moved. Rates are per kg (per unit when no kg rate exists). */
export interface PriceOverviewItem {
  product: string;
  purchases: number;
  suppliers: number;
  /** The most recent purchase */
  latest: { rate: number; date: string; supplierName: string };
  /** The same supplier's purchase before it, and the percent change from it; null for a first purchase */
  previousRate: number | null;
  changePercent: number | null;
  /** The supplier whose latest rate is lowest; only when there are two or more suppliers */
  cheapest: { supplierName: string; rate: number } | null;
  lowest: number;
  highest: number;
  average: number;
  /** The latest purchases, oldest first, for the small trend line */
  series: { date: string; rate: number }[];
  /** What the most recent connected actual invoice charged for it, and what was paid on that purchase */
  sale: { invoiceId: string; invoiceNumber: string; currency: string; rate: number; rateInr: number | null; buyRate: number; date: string } | null;
}

/** Where a product's last purchase rate came from (shown on the Products page). */
export interface LastPurchaseRate {
  product: string;
  rate: number;
  rateBasis: 'KG' | 'UNIT';
  date: string;
  supplierName: string;
}

export interface DuplicateMatch {
  id: string;
  reason: 'invoice-number' | 'same-file';
  invoiceNumber: string;
  supplierName: string;
  invoiceDate: string;
  total: number;
}

export interface ParsedPurchaseLine {
  productName: string;
  description?: string;
  quantity?: number;
  netWeight?: number;
  unit?: string;
  rate: number;
  rateBasis: 'KG' | 'UNIT';
  amount: number;
}

/** What was read from an uploaded Excel invoice, to be checked on the review screen before it is saved. */
export interface ParsedPurchase {
  fileName: string;
  fileHash: string;
  sheetName: string;
  supplierId: string | null;
  /** The supplier name found in the file, when it matched none of the saved suppliers */
  supplierGuess: string | null;
  invoiceNumber: string;
  invoiceDate: string | null;
  purchaseDate: string | null;
  dueDate: string | null;
  subTotal: number | null;
  taxAmount: number;
  freight: number;
  otherCharges: number;
  total: number | null;
  lines: ParsedPurchaseLine[];
  /** Which cell each value came from, for example { invoiceNumber: "F2" } */
  found: Record<string, string>;
  warnings: string[];
  duplicates: DuplicateMatch[];
}

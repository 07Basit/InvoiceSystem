import { z } from 'zod';
import { invoiceSignImageSchema } from './sign.schema';
import { paginationQuerySchema } from './pagination.schema';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Printed on every invoice unless the user edits it for that invoice. */
export const DEFAULT_DECLARATION =
  'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';

// ---------------------------------------------------------------------------
// Line Item
// ---------------------------------------------------------------------------
export const lineItemSchema = z.object({
  id: z.string().cuid().optional(),
  marksAndNos: z.string().trim().max(300).optional(),
  containerNo: z.string().trim().max(120).optional(),
  descriptionOfGoods: z.string().trim().min(1, 'Description of goods is required').max(500),
  netWeightPerPackage: z.coerce.number().positive('Net weight per package must be positive'),
  numberOfBoxes: z.coerce.number().int('Number of boxes must be a whole number').min(1, 'Number of boxes must be at least 1'),
  ratePerKg: z.coerce.number().positive('Rate per kg must be greater than 0'),
});

export type LineItemDto = z.infer<typeof lineItemSchema>;

// ---------------------------------------------------------------------------
// Create Invoice
// ---------------------------------------------------------------------------
/**
 * Normal (the default), party, custom, or both. A party invoice and a custom invoice can each make the other (see "Create custom / party invoice").
 * A BOTH invoice holds a party page and a custom page in one invoice (two pages in the PDF, two sheets in the Excel).
 */
export const INVOICE_KINDS = ['NORMAL', 'PARTY', 'CUSTOM', 'BOTH'] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];

const invoiceFieldsSchema = z.object({
  importerId: z.string().cuid('Invalid importer ID'),
  invoiceNumber: z.string().trim().min(1, 'Invoice number is required').max(120),
  // fixed when the invoice is created; a new invoice is a normal invoice unless it says otherwise
  invoiceKind: z.enum(INVOICE_KINDS).optional(),
  invoiceDate: z.string().datetime({ message: 'Invalid invoice date format' }),
  exportersRef: z.string().trim().max(200).optional(),
  otherReferences: z.string().trim().max(200).optional(),
  awbNumber: z.string().trim().max(120).optional(),
  buyersOrder: z.string().trim().max(200).optional(),
  preCarriageBy: z.string().trim().max(120).default('TRUCK BY ROAD'),
  placeOfReceiptByPreCarrier: z.string().trim().max(120).default('N/A'),
  vesselFlightNo: z.string().trim().max(120).default('By Air'),
  loadingLocationId: z.string().cuid().optional(),
  landingLocationId: z.string().cuid().optional(),
  portOfLoading: z.string().trim().max(80).optional(),
  portOfDischarge: z.string().trim().max(80).optional(),
  finalDestination: z.string().trim().max(120).optional(),
  buyerName: z.string().trim().max(200).optional(),
  // The importer's details as printed on this invoice. Filled from the importer when the invoice is made
  // (like the ports and countries) and then owned by the invoice: later importer edits never change them.
  importerName: z.string().trim().max(200).optional(),
  importerAddress: z.string().trim().max(500).optional(),
  importerContact: z.string().trim().max(120).optional(),
  importerEmail: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address')
    .optional(),
  countryOfOrigin: z.string().trim().max(120).optional(),
  countryOfDestination: z.string().trim().max(120).optional(),
  descriptionOfGoods: z.string().trim().max(400).default('FRUITS & VEGETABLES'),
  hsCode: z.string().trim().max(60).default('709'),
  termsOfDelivery: z.string().trim().max(120).default('CNF YUL'),
  termsOfPayment: z.string().trim().max(120).default('ADVANCE'),
  currency: z.string().trim().toUpperCase().min(3, 'Currency is required').max(6),
  exporterName: z.string().trim().max(200).optional(),
  exporterAddress: z.string().trim().max(500).optional(),
  exporterContact: z.string().trim().max(120).optional(),
  exporterEmail: z.string().email('Invalid exporter email').toLowerCase().optional(),
  bankName: z.string().trim().max(200).optional(),
  bankAccountNumber: z.string().trim().max(60).optional(),
  bankIfscCode: z.string().trim().max(30).optional(),
  bankSwiftCode: z.string().trim().max(30).optional(),
  signName: z.string().trim().max(120).optional(),
  signImage: invoiceSignImageSchema.optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  totalGrossWeight: z.coerce.number().min(0).optional(),
  roundOff: z.coerce.number().default(0),
  amountInWords: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  declaration: z.string().trim().max(2000).optional(),
});

/** The custom page of a BOTH invoice: every field of an invoice except the ones it shares with the party page (number, importer, type). */
export const customVersionSchema = invoiceFieldsSchema.omit({ invoiceNumber: true, importerId: true, invoiceKind: true });
export type CustomVersionDto = z.infer<typeof customVersionSchema>;

export const createInvoiceSchema = invoiceFieldsSchema.extend({
  // only for a BOTH invoice: the content of its custom page
  customVersion: customVersionSchema.optional(),
});
export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;

// ---------------------------------------------------------------------------
// Update Invoice
// ---------------------------------------------------------------------------
export const updateInvoiceSchema = createInvoiceSchema.partial();
export type UpdateInvoiceDto = z.infer<typeof updateInvoiceSchema>;

// ---------------------------------------------------------------------------
// List Query
// ---------------------------------------------------------------------------
/** "a,b,c" in the URL becomes ["a","b","c"] (blank pieces dropped), so one filter can hold several values. */
const csv = <T extends z.ZodTypeAny>(item: T) =>
  z.string().transform((text) => text.split(',').map((part) => part.trim()).filter(Boolean)).pipe(z.array(item).max(50)).optional();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-31').optional();

export const listInvoicesQuerySchema = paginationQuerySchema.extend({
  importerId: csv(z.string().cuid()),
  // invoice date filters: years, months (1-12), a from/to range; and the invoice currencies
  year: csv(z.coerce.number().int().min(1900).max(2200)),
  month: csv(z.coerce.number().int().min(1).max(12)),
  currency: csv(z.string().toUpperCase().regex(/^[A-Z]{3}$/, 'Use 3-letter currency codes')),
  dateFrom: ymd,
  dateTo: ymd,
  // invoice total range
  minTotal: z.coerce.number().min(0).optional(),
  maxTotal: z.coerce.number().min(0).optional(),
  // route and goods
  loadingPort: csv(z.string().max(60)),
  dischargePort: csv(z.string().max(60)),
  country: csv(z.string().max(100)),
  product: csv(z.string().max(200)),
  exporter: csv(z.string().max(200)),
  // regular invoices, actual copies, or both
  type: z.enum(['all', 'regular', 'actual']).optional(),
  // normal, party or custom invoices (all of them when empty)
  kind: z.enum(['normal', 'party', 'custom', 'both']).optional(),
  sort: z.enum(['createdAt', 'invoiceDate', 'total', 'invoiceNumber']).default('createdAt'),
});

/** What the server works with after validation (lists are real arrays). */
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
/** What a client sends in the URL (lists as comma-separated text). */
export type ListInvoicesInput = z.input<typeof listInvoicesQuerySchema>;

// ---------------------------------------------------------------------------
// Bulk actions (several invoices at once)
// ---------------------------------------------------------------------------
/** Most invoices one bulk action works on. */
export const MAX_BULK_INVOICES = 200;

export const bulkInvoiceIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Select at least one invoice').max(MAX_BULK_INVOICES, `Select at most ${MAX_BULK_INVOICES} invoices`),
});
export type BulkInvoiceIdsDto = z.infer<typeof bulkInvoiceIdsSchema>;

/** A ZIP renders every file on the server, so it takes fewer invoices than a delete. */
export const MAX_ZIP_INVOICES = 50;

export const zipInvoicesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Select at least one invoice').max(MAX_ZIP_INVOICES, `A ZIP holds at most ${MAX_ZIP_INVOICES} invoices`),
  formats: z.array(z.enum(['pdf', 'excel'])).min(1, 'Choose PDF, Excel or both').default(['pdf']),
});
export type ZipInvoicesDto = z.infer<typeof zipInvoicesSchema>;

/** Copy the ZIP itself to the clipboard of the computer running the app (local only). */
export const copyZipSchema = zipInvoicesSchema.extend({ text: z.string().max(2000).optional() });
export type CopyZipDto = z.infer<typeof copyZipSchema>;

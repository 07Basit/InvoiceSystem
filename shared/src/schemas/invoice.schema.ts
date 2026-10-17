import { z } from 'zod';
import { invoiceSignImageSchema } from './sign.schema';
import { paginationQuerySchema } from './pagination.schema';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Printed on every invoice unless the user edits it for that invoice. */
export const DEFAULT_DECLARATION =
  'We declare that this Invoice shows the actual price of the goods described and that all particulars are true and correct.';

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
export const createInvoiceSchema = z.object({
  importerId: z.string().cuid('Invalid importer ID'),
  invoiceNumber: z.string().trim().min(1, 'Invoice number is required').max(120),
  invoiceDate: z.string().datetime({ message: 'Invalid invoice date format' }),
  exportersRef: z.string().trim().max(200).optional(),
  otherReferences: z.string().trim().max(200).optional(),
  awbNumber: z.string().trim().max(120).optional(),
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

export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;

// ---------------------------------------------------------------------------
// Update Invoice
// ---------------------------------------------------------------------------
export const updateInvoiceSchema = createInvoiceSchema.partial();
export type UpdateInvoiceDto = z.infer<typeof updateInvoiceSchema>;

// ---------------------------------------------------------------------------
// List Query
// ---------------------------------------------------------------------------
export const listInvoicesQuerySchema = paginationQuerySchema.extend({
  importerId: z.string().cuid().optional(),
  // invoice date filters: a year, a month (1-12), or both; and the invoice currency
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code').optional(),
  sort: z.enum(['createdAt', 'invoiceDate', 'total', 'invoiceNumber']).default('createdAt'),
});

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

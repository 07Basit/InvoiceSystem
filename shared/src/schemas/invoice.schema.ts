import { z } from 'zod';
import { paginationQuerySchema } from './pagination.schema';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const invoiceStatusSchema = z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

// ---------------------------------------------------------------------------
// Line Item
// ---------------------------------------------------------------------------
export const lineItemSchema = z.object({
  id: z.string().cuid().optional(),
  marksAndNos: z.string().trim().max(300).optional(),
  containerNo: z.string().trim().max(120).optional(),
  descriptionOfGoods: z.string().trim().min(1, 'Description of goods is required').max(500),
  netWeightPerPackage: z.coerce.number().positive('Net weight per package must be positive'),
  numberOfBoxes: z.coerce.number().int().min(0, 'Number of boxes cannot be negative'),
  ratePerKg: z.coerce.number().min(0, 'Rate per kg cannot be negative'),
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
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  totalGrossWeight: z.coerce.number().min(0).optional(),
  roundOff: z.coerce.number().default(0),
  amountInWords: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  status: invoiceStatusSchema.default('DRAFT'),
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
  status: invoiceStatusSchema.optional(),
  importerId: z.string().cuid().optional(),
  sort: z.enum(['createdAt', 'invoiceDate', 'total', 'invoiceNumber']).default('createdAt'),
});

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

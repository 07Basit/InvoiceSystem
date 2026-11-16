import type { ParsedPurchase, PurchaseInvoiceDto } from 'shared';
import type { PurchaseInvoice } from '../services/purchaseService';

/** One product line on the form. Numbers are kept as numbers, and a blank box is `undefined`. */
export interface FormLine {
  key: string;
  productName: string;
  quantity: number | undefined;
  netWeight: number | undefined;
  rate: number | undefined;
  rateBasis: 'KG' | 'UNIT';
  amount: number | undefined;
}

export interface PurchaseFormValues {
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  purchaseDate: string;
  dueDate: string;
  lines: FormLine[];
  subTotal: number | undefined;
  taxAmount: number | undefined;
  freight: number | undefined;
  otherCharges: number | undefined;
  total: number | undefined;
  /** The actual invoice the purchase was made for ('' for none), and the text to show for it */
  invoiceId: string;
  invoiceLabel: string;
  notes: string;
  sourceFileName: string;
  sourceHash: string;
}

let counter = 0;
export const newLineKey = () => `line-${Date.now().toString(36)}-${counter++}`;

export const blankLine = (): FormLine => ({ key: newLineKey(), productName: '', quantity: undefined, netWeight: undefined, rate: undefined, rateBasis: 'KG', amount: undefined });

export const emptyPurchase = (): PurchaseFormValues => ({
  supplierId: '', invoiceNumber: '', invoiceDate: '', purchaseDate: '', dueDate: '', lines: [blankLine()],
  subTotal: undefined, taxAmount: undefined, freight: undefined, otherCharges: undefined, total: undefined, invoiceId: '', invoiceLabel: '', notes: '', sourceFileName: '', sourceHash: '',
});

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** What a line comes to: the rate times the kilos (rate per kilo) or times the quantity (rate per unit). */
export function lineAmount(line: Pick<FormLine, 'rate' | 'rateBasis' | 'netWeight' | 'quantity'>): number | undefined {
  const base = line.rateBasis === 'KG' ? line.netWeight : line.quantity;
  return line.rate !== undefined && base !== undefined ? round2(line.rate * base) : undefined;
}

export const sumLines = (lines: FormLine[]) => round2(lines.reduce((sum, l) => sum + (l.amount ?? 0), 0));

export const expectedTotal = (v: Pick<PurchaseFormValues, 'subTotal' | 'taxAmount' | 'freight' | 'otherCharges'>) =>
  round2((v.subTotal ?? 0) + (v.taxAmount ?? 0) + (v.freight ?? 0) + (v.otherCharges ?? 0));

/** Review screen values from what was read out of an Excel file. */
export function fromParsed(parsed: ParsedPurchase): PurchaseFormValues {
  const lines: FormLine[] = parsed.lines.map((l) => ({ key: newLineKey(), productName: l.productName, quantity: l.quantity, netWeight: l.netWeight, rate: l.rate, rateBasis: l.rateBasis, amount: l.amount }));
  const subTotal = parsed.subTotal ?? sumLines(lines);
  return {
    supplierId: parsed.supplierId ?? '',
    invoiceNumber: parsed.invoiceNumber,
    invoiceDate: parsed.invoiceDate ?? '',
    purchaseDate: parsed.purchaseDate ?? '',
    dueDate: parsed.dueDate ?? '',
    lines: lines.length ? lines : [blankLine()],
    subTotal,
    taxAmount: parsed.taxAmount || undefined,
    freight: parsed.freight || undefined,
    otherCharges: parsed.otherCharges || undefined,
    total: parsed.total ?? expectedTotal({ subTotal, taxAmount: parsed.taxAmount, freight: parsed.freight, otherCharges: parsed.otherCharges }),
    invoiceId: '',
    invoiceLabel: '',
    notes: '',
    sourceFileName: parsed.fileName,
    sourceHash: parsed.fileHash,
  };
}

/** Edit screen values from a saved purchase invoice. */
export function fromSaved(p: PurchaseInvoice): PurchaseFormValues {
  return {
    supplierId: p.supplierId, invoiceNumber: p.invoiceNumber, invoiceDate: p.invoiceDate, purchaseDate: p.purchaseDate ?? '', dueDate: p.dueDate ?? '',
    lines: p.lines.map((l) => ({ key: l.id, productName: l.productName, quantity: l.quantity ?? undefined, netWeight: l.netWeight ?? undefined, rate: l.rate, rateBasis: l.rateBasis, amount: l.amount })),
    subTotal: p.subTotal, taxAmount: p.taxAmount || undefined, freight: p.freight || undefined, otherCharges: p.otherCharges || undefined, total: p.total,
    invoiceId: p.invoiceId ?? '', invoiceLabel: p.invoice ? [p.invoice.invoiceNumber, p.invoice.importerName].filter(Boolean).join(' · ') : '',
    notes: p.notes ?? '', sourceFileName: p.sourceFileName ?? '', sourceHash: '',
  };
}

/** What is sent to the server (blank lines are dropped; the server checks the rest). */
export function toDto(v: PurchaseFormValues): PurchaseInvoiceDto {
  const lines = v.lines
    .filter((l) => l.productName.trim() || l.amount || l.rate)
    .map((l) => ({
      productName: l.productName.trim(),
      ...(l.quantity !== undefined ? { quantity: l.quantity } : {}),
      ...(l.netWeight !== undefined ? { netWeight: l.netWeight } : {}),
      rate: l.rate ?? 0,
      rateBasis: l.rateBasis,
      amount: l.amount ?? 0,
    }));
  const subTotal = v.subTotal ?? sumLines(v.lines);
  return {
    supplierId: v.supplierId,
    invoiceNumber: v.invoiceNumber.trim(),
    invoiceDate: v.invoiceDate,
    ...(v.purchaseDate ? { purchaseDate: v.purchaseDate } : {}),
    ...(v.dueDate ? { dueDate: v.dueDate } : {}),
    lines,
    subTotal,
    taxAmount: v.taxAmount ?? 0,
    freight: v.freight ?? 0,
    otherCharges: v.otherCharges ?? 0,
    total: v.total ?? expectedTotal({ ...v, subTotal }),
    ...(v.invoiceId ? { invoiceId: v.invoiceId } : {}),
    ...(v.notes.trim() ? { notes: v.notes.trim() } : {}),
    ...(v.sourceFileName ? { sourceFileName: v.sourceFileName } : {}),
    ...(v.sourceHash ? { sourceHash: v.sourceHash } : {}),
  };
}

/** What stops a purchase being saved yet, in plain words (empty when it can be saved). */
export function problemsOf(v: PurchaseFormValues): string[] {
  const out: string[] = [];
  if (!v.supplierId) out.push('Choose the supplier.');
  if (!v.invoiceNumber.trim()) out.push('Enter the invoice number.');
  if (!v.invoiceDate) out.push('Enter the invoice date.');
  if (!v.lines.some((l) => l.productName.trim())) out.push('Add at least one product.');
  if (v.lines.some((l) => (l.rate || l.amount) && !l.productName.trim())) out.push('A line has a rate or amount but no product.');
  return out;
}

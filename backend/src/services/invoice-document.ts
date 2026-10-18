import { DEFAULT_DECLARATION } from 'shared';

/**
 * One structured description of an invoice, built once and rendered by both the PDF and the Excel export,
 * so the two documents always carry the same fields in the same order.
 */

export interface DocField {
  label: string;
  /** Display text; empty when the invoice has no value (left blank in the documents). */
  value: string;
}

export interface DocParty {
  name: string;
  /** Address, contact and email, one per line, empty ones left out. */
  details: string[];
  email: string;
}

export interface DocLine {
  no: number;
  marks: string;
  description: string;
  nettPerPackage: number;
  boxes: number;
  totalNett: number;
  rate: number;
  totalPerBox: number;
  amount: number;
}

export interface DocSign {
  name: string;
  mime: 'image/png' | 'image/jpeg';
  bytes: Buffer;
}

export interface InvoiceDocument {
  invoiceNumber: string;
  /** "PARTY" or "CUSTOM" shown under the invoice title; empty for a normal invoice */
  kindLabel: string;
  invoiceDate: string;
  currency: string;
  exporter: DocParty;
  importer: DocParty;
  buyer: string;
  references: DocField[];
  shipping: DocField[];
  goods: DocField[];
  lines: DocLine[];
  totals: { packages: number; nettWeight: number; grossWeight: number | null; subTotal: number; total: number };
  amountInWords: string;
  bank: DocField[];
  declaration: string;
  sign: DocSign | null;
  fileName: string;
}

/** The parts of a loaded invoice the documents need (Prisma Decimals arrive as objects with toString). */
type Num = number | { toString(): string };
export interface InvoiceSource {
  invoiceNumber: string;
  /** For an actual invoice: the invoice it was made from. The documents show that invoice's number, not "ACTUAL ...". */
  actualOf?: { invoiceNumber: string } | null;
  /** The number printed inside the documents of a copy (saved when the copy was made). */
  printedNumber?: string | null;
  /** NORMAL, PARTY or CUSTOM */
  invoiceKind?: string | null;
  invoiceDate: Date;
  currency: string;
  exporterName: string | null;
  exporterAddress: string | null;
  exporterContact: string | null;
  exporterEmail: string | null;
  importerName: string | null;
  importerAddress: string | null;
  importerContact: string | null;
  importerEmail: string | null;
  importer: { name: string };
  buyerName: string | null;
  exportersRef: string | null;
  otherReferences: string | null;
  awbNumber: string | null;
  buyersOrder: string | null;
  preCarriageBy: string | null;
  placeOfReceiptByPreCarrier: string | null;
  vesselFlightNo: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  finalDestination: string | null;
  countryOfOrigin: string | null;
  countryOfDestination: string | null;
  descriptionOfGoods: string | null;
  hsCode: string | null;
  termsOfDelivery: string | null;
  termsOfPayment: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  bankSwiftCode: string | null;
  declaration: string | null;
  signName: string | null;
  signImage: string | null;
  totalBoxes: number;
  totalNetWeight: Num;
  totalGrossWeight: Num | null;
  subTotal: Num;
  total: Num;
  amountInWords: string | null;
  lineItems: {
    marksAndNos: string | null;
    containerNo: string | null;
    descriptionOfGoods: string;
    netWeightPerPackage: Num;
    numberOfBoxes: number;
    totalNetWeight: Num;
    ratePerKg: Num;
    totalPerBox: Num;
    amount: Num;
  }[];
}

const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function hundreds(n: number): string {
  if (n < 20) return ONES[n]!;
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${hundreds(n % 100)}` : ''}`;
}

/** 1234 -> "One Thousand Two Hundred Thirty Four". */
export function numberToWords(value: number): string {
  let rest = Math.floor(Math.abs(value));
  if (!Number.isFinite(rest) || rest === 0) return 'Zero';
  const scales = ['', 'Thousand', 'Million', 'Billion'];
  const parts: string[] = [];
  for (let i = 0; rest > 0 && i < scales.length; i++, rest = Math.floor(rest / 1000)) {
    const chunk = rest % 1000;
    if (chunk) parts.unshift(`${hundreds(chunk)}${scales[i] ? ` ${scales[i]}` : ''}`);
  }
  return parts.join(' ');
}

const MINOR_UNIT: Record<string, string> = { GBP: 'Pence', INR: 'Paise', AED: 'Fils' };

/** Same wording as the invoice form: "One Thousand and Fifty Cents". Used when an older invoice has none saved. */
export function amountInWords(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return '';
  const abs = Math.abs(amount);
  const major = Math.floor(abs);
  const minor = Math.round((abs - major) * 100);
  const words = numberToWords(major);
  return minor === 0 ? words : `${words} and ${numberToWords(minor)} ${MINOR_UNIT[currency.toUpperCase()] ?? 'Cents'}`;
}

const SMALL_WORDS = new Set(['of', 'and', 'the', 'in', 'on', 'at', 'to', 'for', 'by', 'da', 'de', 'del', 'la']);

const num = (v: Num | null | undefined) => Number(v ?? 0);
const text = (v: string | null | undefined) => (v ?? '').trim();
const show = (v: string | null | undefined) => text(v);

/** 12345.6 -> "12,345.60". */
export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number.isFinite(value) ? value : 0);
}

/** 2026-10-17 -> "17 Oct 2026" (dates are stored at UTC midnight, so read them in UTC). */
export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(value);
}

export const formatPortCode = (v: string | null | undefined) => text(v).toUpperCase();

/** "united states" -> "United States" (small words like "of" stay lower case). */
export function formatCountry(v: string | null | undefined): string {
  return text(v)
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part, i) => (/^[a-z]/.test(part) && (i === 0 || !SMALL_WORDS.has(part)) ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join('');
}

function party(name: string, address: string | null, contact: string | null, email: string | null): DocParty {
  return {
    name: text(name),
    details: [text(address), text(contact) ? `Contact: ${text(contact)}` : '', text(email) ? `Email: ${text(email)}` : ''].filter(Boolean),
    email: text(email),
  };
}

function decodeSign(name: string | null, image: string | null): DocSign | null {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(image ?? '');
  if (!match) return null;
  return { name: text(name), mime: match[1] === 'png' ? 'image/png' : 'image/jpeg', bytes: Buffer.from(match[2]!, 'base64') };
}

/** Safe for a download file name: letters, digits, dot, dash and underscore. */
export function safeFileName(invoiceNumber: string): string {
  return text(invoiceNumber).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._-]+|[._-]+$/g, '') || 'invoice';
}

/** The number printed inside the invoice: a copy (actual, party or custom partner) carries the number of the invoice it was made from. */
export const printedInvoiceNumber = (invoice: Pick<InvoiceSource, 'invoiceNumber' | 'actualOf' | 'printedNumber'>) => invoice.printedNumber || invoice.actualOf?.invoiceNumber || invoice.invoiceNumber;

export function buildInvoiceDocument(invoice: InvoiceSource): InvoiceDocument {
  const lines: DocLine[] = invoice.lineItems.map((item, index) => ({
    no: index + 1,
    marks: [text(item.marksAndNos), text(item.containerNo) && text(item.containerNo) !== text(item.marksAndNos) ? text(item.containerNo) : ''].filter(Boolean).join(' / '),
    description: text(item.descriptionOfGoods),
    nettPerPackage: num(item.netWeightPerPackage),
    boxes: item.numberOfBoxes,
    totalNett: num(item.totalNetWeight),
    rate: num(item.ratePerKg),
    totalPerBox: num(item.totalPerBox),
    amount: num(item.amount),
  }));

  return {
    invoiceNumber: printedInvoiceNumber(invoice),
    kindLabel: invoice.invoiceKind === 'CUSTOM' ? 'CUSTOM' : invoice.invoiceKind === 'PARTY' ? 'PARTY' : '',
    invoiceDate: formatDate(invoice.invoiceDate),
    currency: invoice.currency,
    exporter: party(text(invoice.exporterName), invoice.exporterAddress, invoice.exporterContact, invoice.exporterEmail),
    importer: party(text(invoice.importerName) || invoice.importer.name, invoice.importerAddress, invoice.importerContact, invoice.importerEmail),
    buyer: show(invoice.buyerName),
    references: [
      { label: 'Invoice No.', value: show(printedInvoiceNumber(invoice)) },
      { label: 'Invoice Date', value: formatDate(invoice.invoiceDate) },
      { label: "Exporter's Ref.", value: show(invoice.exportersRef) },
      { label: "Buyer's Order No. & Date", value: show(invoice.buyersOrder) },
      { label: 'Other Reference(s)', value: show(invoice.otherReferences) },
      { label: 'AWB No.', value: show(invoice.awbNumber) },
      { label: 'Currency', value: show(invoice.currency) },
    ],
    shipping: [
      { label: 'Pre-Carriage by', value: show(invoice.preCarriageBy) },
      { label: 'Place of Receipt by Pre-Carrier', value: show(invoice.placeOfReceiptByPreCarrier) },
      { label: 'Vessel / Flight No.', value: show(invoice.vesselFlightNo) },
      { label: 'Port of Loading', value: show(formatPortCode(invoice.portOfLoading)) },
      { label: 'Port of Discharge', value: show(formatPortCode(invoice.portOfDischarge)) },
      { label: 'Final Destination', value: show(formatPortCode(invoice.finalDestination)) },
      { label: 'Country of Origin', value: show(formatCountry(invoice.countryOfOrigin)) },
      { label: 'Country of Destination', value: show(formatCountry(invoice.countryOfDestination)) },
    ],
    goods: [
      { label: 'Description of Goods', value: show(invoice.descriptionOfGoods) },
      { label: 'HS Code', value: show(invoice.hsCode) },
      { label: 'Terms of Delivery', value: show(invoice.termsOfDelivery) },
      { label: 'Terms of Payment', value: show(invoice.termsOfPayment) },
    ],
    lines,
    totals: {
      packages: invoice.totalBoxes,
      nettWeight: num(invoice.totalNetWeight),
      grossWeight: invoice.totalGrossWeight === null || invoice.totalGrossWeight === undefined ? null : num(invoice.totalGrossWeight),
      subTotal: num(invoice.subTotal),
      total: num(invoice.total),
    },
    amountInWords: text(invoice.amountInWords) || amountInWords(num(invoice.total), invoice.currency),
    bank: [
      { label: 'Bank Name', value: show(invoice.bankName) },
      { label: 'Account Number', value: show(invoice.bankAccountNumber) },
      { label: 'IFSC Code', value: show(invoice.bankIfscCode) },
      { label: 'SWIFT Code', value: show(invoice.bankSwiftCode) },
    ],
    declaration: text(invoice.declaration) || DEFAULT_DECLARATION,
    sign: decodeSign(invoice.signName, invoice.signImage),
    fileName: safeFileName(invoice.invoiceNumber),
  };
}

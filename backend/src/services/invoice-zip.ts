import JSZip from 'jszip';
import { buildInvoiceDocument } from './invoice-document';
import { renderInvoicePdf } from './invoice-pdf';
import { renderInvoiceExcel } from './invoice-excel';
import type { InvoiceSource } from './invoice-document';

export type ZipFormat = 'pdf' | 'excel';

const EXTENSION: Record<ZipFormat, string> = { pdf: 'pdf', excel: 'xlsx' };

/** Packs the PDF and/or Excel file of every invoice into one ZIP (files named invoice-NUMBER.pdf / .xlsx). */
export async function zipInvoices(invoices: InvoiceSource[], formats: ZipFormat[]): Promise<Buffer> {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const invoice of invoices) {
    const doc = buildInvoiceDocument(invoice);
    for (const format of formats) {
      // two invoices can differ only by characters a file name drops, so keep every name unique
      let base = `invoice-${doc.fileName}`;
      for (let n = 2; used.has(`${base}.${EXTENSION[format]}`); n++) base = `invoice-${doc.fileName}-${n}`;
      const name = `${base}.${EXTENSION[format]}`;
      used.add(name);
      zip.file(name, format === 'pdf' ? Buffer.from(await renderInvoicePdf(doc)) : await renderInvoiceExcel(doc));
    }
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

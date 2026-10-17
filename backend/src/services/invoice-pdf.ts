import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { formatNumber, type DocField, type DocParty, type InvoiceDocument } from './invoice-document';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 48; // room kept for the page footer

const TEAL = rgb(0.027, 0.17, 0.17);
const TEAL_SOFT = rgb(0.9, 0.95, 0.95);
const ORANGE = rgb(1, 0.4, 0);
const INK = rgb(0.1, 0.12, 0.14);
const MUTED = rgb(0.42, 0.46, 0.5);
const LINE = rgb(0.82, 0.86, 0.87);
const ROW_ALT = rgb(0.972, 0.982, 0.982);
const WHITE = rgb(1, 1, 1);

/** Replacements for characters the built-in PDF fonts cannot draw. */
const FALLBACKS: Record<string, string> = { '₹': 'Rs', '€': 'EUR', '£': 'GBP', '“': '"', '”': '"', '‘': "'", '’': "'", '–': '-', '—': '-', '•': '*', '…': '...', ' ': ' ' };

class Writer {
  readonly doc: PDFDocument;
  regular!: PDFFont;
  bold!: PDFFont;
  page!: PDFPage;
  /** Top of the free space on the current page (PDF y grows upwards). */
  y = 0;
  private supported!: Set<number>;

  constructor(doc: PDFDocument) {
    this.doc = doc;
  }

  async init() {
    this.regular = await this.doc.embedFont(StandardFonts.Helvetica);
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.supported = new Set(this.regular.getCharacterSet());
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  /** Text the font can draw: unknown characters get a fallback or a "?". */
  safe(value: string): string {
    return [...value]
      .map((ch) => {
        const code = ch.codePointAt(0)!;
        if (code === 9) return ' ';
        if (this.supported.has(code)) return ch;
        return FALLBACKS[ch] ?? '?';
      })
      .join('');
  }

  width(value: string, size: number, font = this.regular) {
    return font.widthOfTextAtSize(this.safe(value), size);
  }

  /** Word-wraps to a width; honours line breaks; splits words that are wider than the box. */
  wrap(value: string, size: number, maxWidth: number, font = this.regular): string[] {
    const out: string[] = [];
    for (const paragraph of this.safe(value).split(/\r?\n/)) {
      let current = '';
      for (const word of paragraph.split(' ')) {
        let piece = word;
        while (font.widthOfTextAtSize(piece, size) > maxWidth && piece.length > 1) {
          let cut = piece.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(piece.slice(0, cut), size) > maxWidth) cut--;
          if (current) { out.push(current); current = ''; }
          out.push(piece.slice(0, cut));
          piece = piece.slice(cut);
        }
        const next = current ? `${current} ${piece}` : piece;
        if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
          out.push(current);
          current = piece;
        } else {
          current = next;
        }
      }
      out.push(current);
    }
    return out;
  }

  /** Draws one line with its top at `top`. `align` is relative to x..x+boxWidth. */
  text(value: string, x: number, top: number, size: number, opts: { font?: PDFFont; color?: RGB; align?: 'left' | 'right' | 'center'; boxWidth?: number } = {}) {
    const font = opts.font ?? this.regular;
    const safe = this.safe(value);
    const w = font.widthOfTextAtSize(safe, size);
    const box = opts.boxWidth ?? 0;
    const dx = opts.align === 'right' ? box - w : opts.align === 'center' ? (box - w) / 2 : 0;
    this.page.drawText(safe, { x: x + dx, y: top - size, font, size, color: opts.color ?? INK });
  }

  ensure(height: number) {
    if (this.y - height < BOTTOM) this.newPage();
  }
}

/** `keepWith` is how much content must fit under the title, so a heading is never left alone at the foot of a page. */
function sectionTitle(w: Writer, title: string, keepWith = 50) {
  w.ensure(keepWith);
  w.y -= 6;
  w.page.drawRectangle({ x: MARGIN, y: w.y - 12, width: 3, height: 12, color: ORANGE });
  w.text(title.toUpperCase(), MARGIN + 9, w.y, 8.5, { font: w.bold, color: TEAL });
  w.page.drawLine({ start: { x: MARGIN + 9 + w.width(title.toUpperCase(), 8.5, w.bold) + 8, y: w.y - 6 }, end: { x: PAGE_W - MARGIN, y: w.y - 6 }, thickness: 0.6, color: LINE });
  w.y -= 18;
}

/** Label/value pairs in `cols` columns; each cell grows to fit its wrapped value. */
function fieldGrid(w: Writer, fields: DocField[], cols: number) {
  const cellW = CONTENT_W / cols;
  for (let i = 0; i < fields.length; i += cols) {
    const row = fields.slice(i, i + cols);
    const measured = row.map((f) => ({ f, lines: w.wrap(f.value, 9, cellW - 12, w.bold) }));
    const rowH = 12 + Math.max(...measured.map((m) => m.lines.length)) * 12 + 3;
    w.ensure(rowH);
    measured.forEach(({ f, lines }, c) => {
      const x = MARGIN + c * cellW;
      w.text(f.label, x, w.y, 7, { color: MUTED });
      lines.forEach((line, li) => w.text(line, x, w.y - 11 - li * 12, 9, { font: w.bold }));
    });
    w.y -= rowH;
  }
}

function partyBox(w: Writer, x: number, width: number, top: number, height: number, title: string, p: DocParty) {
  const innerW = width - 20;
  const nameLines = w.wrap(p.name, 11, innerW, w.bold);
  const detailLines = p.details.flatMap((d) => w.wrap(d, 8.5, innerW));
  w.page.drawRectangle({ x, y: top - height, width, height, color: ROW_ALT, borderColor: LINE, borderWidth: 0.7 });
  w.page.drawRectangle({ x, y: top - height, width: 3, height, color: ORANGE });
  w.text(title.toUpperCase(), x + 12, top - 9, 7, { font: w.bold, color: MUTED });
  let cursor = top - 24;
  nameLines.forEach((line) => { w.text(line, x + 12, cursor, 11, { font: w.bold }); cursor -= 14; });
  detailLines.forEach((line) => { w.text(line, x + 12, cursor, 8.5, { color: INK }); cursor -= 11.5; });
}

function parties(w: Writer, doc: InvoiceDocument) {
  const gap = 12;
  const boxW = (CONTENT_W - gap) / 2;
  // measure both first so they share one height
  const measure = (p: DocParty) => 30 + w.wrap(p.name, 11, boxW - 20, w.bold).length * 14 + p.details.flatMap((d) => w.wrap(d, 8.5, boxW - 20)).length * 11.5 + 10;
  const height = Math.max(measure(doc.exporter), measure(doc.importer));
  w.ensure(height + 40);
  const top = w.y;
  partyBox(w, MARGIN, boxW, top, height, 'Exporter', doc.exporter);
  partyBox(w, MARGIN + boxW + gap, boxW, top, height, 'Importer / Consignee', doc.importer);
  w.y = top - height - 8;
  w.page.drawRectangle({ x: MARGIN, y: w.y - 22, width: CONTENT_W, height: 22, borderColor: LINE, borderWidth: 0.7 });
  w.text('Buyer (if other than consignee):', MARGIN + 10, w.y - 7, 8, { color: MUTED });
  w.text(doc.buyer, MARGIN + 10 + w.width('Buyer (if other than consignee):', 8) + 8, w.y - 6, 9, { font: w.bold });
  w.y -= 30;
}

interface Col { title: string[]; width: number; align: 'left' | 'right' }

function itemsTable(w: Writer, doc: InvoiceDocument) {
  const cols: Col[] = [
    { title: ['NO'], width: 20, align: 'left' },
    { title: ['MARKS &', 'CONTAINER'], width: 80, align: 'left' },
    { title: ['DESCRIPTION', 'OF GOODS'], width: 117, align: 'left' },
    { title: ['NETT WT', 'PER PKG'], width: 48, align: 'right' },
    { title: ['NO OF', 'BOXES'], width: 38, align: 'right' },
    { title: ['TOTAL', 'NETT WT'], width: 56, align: 'right' },
    { title: ['RATE', 'PER KG'], width: 48, align: 'right' },
    { title: ['TOTAL', 'PER BOX'], width: 52, align: 'right' },
    { title: [`AMOUNT`, `(${doc.currency})`], width: 64, align: 'right' },
  ];
  const total = cols.reduce((s, c) => s + c.width, 0);
  const scale = CONTENT_W / total;
  const widths = cols.map((c) => c.width * scale);
  const pad = 4;

  const header = () => {
    w.ensure(60);
    w.page.drawRectangle({ x: MARGIN, y: w.y - 26, width: CONTENT_W, height: 26, color: TEAL });
    let x = MARGIN;
    cols.forEach((c, i) => {
      c.title.forEach((t, li) => w.text(t, x + pad, w.y - 6 - li * 9, 6.8, { font: w.bold, color: WHITE, align: c.align, boxWidth: widths[i]! - pad * 2 }));
      x += widths[i]!;
    });
    w.y -= 26;
  };

  header();
  doc.lines.forEach((line, index) => {
    const marks = w.wrap(line.marks, 8, widths[1]! - pad * 2);
    const desc = w.wrap(line.description, 8, widths[2]! - pad * 2);
    const rowH = Math.max(marks.length, desc.length, 1) * 10 + 10;
    if (w.y - rowH < BOTTOM) { w.newPage(); header(); }
    if (index % 2 === 1) w.page.drawRectangle({ x: MARGIN, y: w.y - rowH, width: CONTENT_W, height: rowH, color: ROW_ALT });
    const cells: (string | string[])[] = [
      String(line.no), marks, desc,
      formatNumber(line.nettPerPackage), String(line.boxes), `${formatNumber(line.totalNett)}`, formatNumber(line.rate, 2), formatNumber(line.totalPerBox), formatNumber(line.amount),
    ];
    let x = MARGIN;
    cells.forEach((cell, i) => {
      const col = cols[i]!;
      const lines = Array.isArray(cell) ? cell : [cell];
      lines.forEach((t, li) => w.text(t, x + pad, w.y - 5 - li * 10, 8, { align: col.align, boxWidth: widths[i]! - pad * 2, font: i === cols.length - 1 ? w.bold : w.regular }));
      x += widths[i]!;
    });
    w.page.drawLine({ start: { x: MARGIN, y: w.y - rowH }, end: { x: PAGE_W - MARGIN, y: w.y - rowH }, thickness: 0.4, color: LINE });
    w.y -= rowH;
  });
  w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: PAGE_W - MARGIN, y: w.y }, thickness: 0.8, color: TEAL });
  w.y -= 12;
}

function totals(w: Writer, doc: InvoiceDocument) {
  const boxW = 215;
  const rows: [string, string, boolean][] = [
    ['No. of Packages', String(doc.totals.packages), false],
    ['Total Nett Weight', `${formatNumber(doc.totals.nettWeight)} KGS`, false],
    ...(doc.totals.grossWeight !== null ? ([['Total Gross Weight', `${formatNumber(doc.totals.grossWeight)} KGS`, false]] as [string, string, boolean][]) : []),
    ['Sub Total', `${doc.currency} ${formatNumber(doc.totals.subTotal)}`, false],
  ];
  const words = w.wrap(doc.amountInWords ? `${doc.currency} ${doc.amountInWords}` : '', 9, CONTENT_W - boxW - 32, w.bold);
  const height = Math.max(rows.length * 15 + 32, words.length * 12 + 34);
  w.ensure(height + 10);
  const top = w.y;
  const leftW = CONTENT_W - boxW - 12;

  // amount in words
  w.page.drawRectangle({ x: MARGIN, y: top - height, width: leftW, height, color: ROW_ALT, borderColor: LINE, borderWidth: 0.7 });
  w.text('AMOUNT IN WORDS', MARGIN + 10, top - 9, 7, { font: w.bold, color: MUTED });
  words.forEach((line, i) => w.text(line, MARGIN + 10, top - 22 - i * 12, 9, { font: w.bold }));

  // totals
  const x = PAGE_W - MARGIN - boxW;
  w.page.drawRectangle({ x, y: top - height, width: boxW, height, borderColor: LINE, borderWidth: 0.7 });
  rows.forEach(([label, value], i) => {
    w.text(label, x + 10, top - 9 - i * 15, 8.5, { color: MUTED });
    w.text(value, x + 10, top - 9 - i * 15, 8.5, { font: w.bold, align: 'right', boxWidth: boxW - 20 });
  });
  w.page.drawRectangle({ x, y: top - height, width: boxW, height: 26, color: TEAL });
  w.text('TOTAL', x + 10, top - height + 18, 9, { font: w.bold, color: WHITE });
  w.text(`${doc.currency} ${formatNumber(doc.totals.total)}`, x + 10, top - height + 18, 11, { font: w.bold, color: WHITE, align: 'right', boxWidth: boxW - 20 });
  w.y = top - height - 8;
}

async function signature(w: Writer, doc: InvoiceDocument) {
  const boxW = 215;
  let image: Awaited<ReturnType<PDFDocument['embedPng']>> | null = null;
  if (doc.sign) {
    try {
      image = doc.sign.mime === 'image/png' ? await w.doc.embedPng(doc.sign.bytes) : await w.doc.embedJpg(doc.sign.bytes);
    } catch {
      image = null; // a damaged image must never stop the PDF
    }
  }
  const scale = image ? Math.min(160 / image.width, 62 / image.height, 1) : 0;
  const imgW = image ? image.width * scale : 0;
  const imgH = image ? image.height * scale : 0;
  const height = 24 + Math.max(imgH, 40) + 22;
  w.ensure(height + 6);
  const x = PAGE_W - MARGIN - boxW;
  const top = w.y;
  w.text(`For ${doc.exporter.name}`, x, top, 8.5, { font: w.bold, align: 'right', boxWidth: boxW });
  if (image) w.page.drawImage(image, { x: x + boxW - imgW, y: top - 14 - imgH, width: imgW, height: imgH });
  w.page.drawLine({ start: { x, y: top - 18 - Math.max(imgH, 40) }, end: { x: x + boxW, y: top - 18 - Math.max(imgH, 40) }, thickness: 0.6, color: MUTED });
  w.text('Authorised Signatory', x, top - 22 - Math.max(imgH, 40), 7.5, { color: MUTED, align: 'right', boxWidth: boxW });
  w.y = top - height;
}

function footers(w: Writer, doc: InvoiceDocument) {
  const pages = w.doc.getPages();
  pages.forEach((page, i) => {
    page.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: PAGE_W - MARGIN, y: 38 }, thickness: 0.5, color: LINE });
    const left = w.safe(`Invoice ${doc.invoiceNumber}  |  ${doc.exporter.name}`);
    page.drawText(left, { x: MARGIN, y: 26, size: 7.5, font: w.regular, color: MUTED });
    const right = `Page ${i + 1} of ${pages.length}`;
    page.drawText(right, { x: PAGE_W - MARGIN - w.regular.widthOfTextAtSize(right, 7.5), y: 26, size: 7.5, font: w.regular, color: MUTED });
  });
}

/** Renders the structured invoice as an A4 PDF: sections in a fixed order, tables that flow onto further pages. */
export async function renderInvoicePdf(doc: InvoiceDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${doc.invoiceNumber}`);
  pdf.setSubject(`Invoice from ${doc.exporter.name} to ${doc.importer.name}`);
  pdf.setCreator('Invoice Manager');
  const w = new Writer(pdf);
  await w.init();

  // title band
  w.page.drawRectangle({ x: 0, y: PAGE_H - 72, width: PAGE_W, height: 72, color: TEAL });
  w.page.drawRectangle({ x: 0, y: PAGE_H - 76, width: PAGE_W, height: 4, color: ORANGE });
  w.text('INVOICE', MARGIN, PAGE_H - 24, 26, { font: w.bold, color: WHITE });
  w.text('COMMERCIAL INVOICE', MARGIN, PAGE_H - 54, 7.5, { color: rgb(0.7, 0.85, 0.85) });
  w.text(`No. ${doc.invoiceNumber}`, PAGE_W - MARGIN - 220, PAGE_H - 22, 12, { font: w.bold, color: WHITE, align: 'right', boxWidth: 220 });
  w.text(`Date ${doc.invoiceDate}`, PAGE_W - MARGIN - 220, PAGE_H - 40, 9.5, { color: WHITE, align: 'right', boxWidth: 220 });
  w.text(`Currency ${doc.currency}`, PAGE_W - MARGIN - 220, PAGE_H - 55, 9.5, { color: WHITE, align: 'right', boxWidth: 220 });
  w.y = PAGE_H - 88;

  parties(w, doc);
  sectionTitle(w, 'Invoice references');
  // number, date and currency already sit in the title band
  fieldGrid(w, doc.references.filter((f) => !['Invoice No.', 'Invoice Date', 'Currency'].includes(f.label)), 4);
  sectionTitle(w, 'Shipping and route');
  fieldGrid(w, doc.shipping, 4);
  sectionTitle(w, 'Goods and terms');
  fieldGrid(w, [...doc.goods.slice(1), doc.goods[0]!], 4);
  sectionTitle(w, 'Product details');
  itemsTable(w, doc);
  totals(w, doc);
  sectionTitle(w, 'Bank details');
  fieldGrid(w, doc.bank, 4);
  sectionTitle(w, 'Declaration and signature', 135);
  const declW = CONTENT_W - 215 - 24;
  const declLines = w.wrap(doc.declaration, 8.5, declW);
  const declHeight = declLines.length * 12;
  const startTop = w.y;
  declLines.forEach((line, i) => w.text(line, MARGIN, startTop - i * 12, 8.5));
  const afterDecl = startTop - declHeight;
  w.y = startTop;
  await signature(w, doc);
  w.y = Math.min(w.y, afterDecl) - 4;

  footers(w, doc);
  return pdf.save();
}

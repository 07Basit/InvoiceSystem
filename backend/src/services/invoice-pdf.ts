import { PDFDocument, StandardFonts, concatTransformationMatrix, popGraphicsState, pushGraphicsState, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';
import { LOGO_HEIGHT, LOGO_PNG_BASE64, LOGO_WIDTH, TAGLINE } from '../assets/branding';
import { formatNumber, type DocField, type DocParty, type InvoiceDocument } from './invoice-document';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
/** The design is drawn on a 794 x 1123 grid (A4 at 96 dpi); `px` turns a design size into PDF points. */
const S = PAGE_W / 794;
const px = (n: number) => n * S;
const MARGIN = px(52);
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 48; // room kept for the page footer

const hex = (value: string): RGB => rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255);
const PRIMARY = hex('#1f5a3b');
const ACCENT = hex('#f2a516');
const ON_ACCENT = hex('#2b1d00');
const TINT = hex('#eef6f0');
const TINT_STRONG = hex('#d4e5d9');
const INK = hex('#14291c');
const MUTED = hex('#46594d');
const FAINT = hex('#5e7567');
const WHITE = rgb(1, 1, 1);
const ON_BAND = hex('#c7d7cd'); // white at 75% over the green band
const ON_BAND_SOFT = hex('#e3ede7');

const BAND_H = px(160);
const STRIP_H = px(6);

/** Replacements for characters the built-in PDF fonts cannot draw. */
const FALLBACKS: Record<string, string> = { '₹': 'Rs', '€': 'EUR', '£': 'GBP', '“': '"', '”': '"', '‘': "'", '’': "'", '–': '-', '—': '-', '•': '*', '…': '...', ' ': ' ' };

type Radii = [number, number, number, number]; // top-left, top-right, bottom-right, bottom-left

/**
 * Extra room an invoice with few lines spreads over its layout so it fills the A4 page (and prints large and easy to read):
 * `pad` goes into the product rows (each side), `gap` between the sections, `cell` between the rows of the shipment details.
 */
interface Fill { pad: number; gap: number; cell: number }
const NO_FILL: Fill = { pad: 0, gap: 0, cell: 0 };

class Writer {
  readonly doc: PDFDocument;
  regular!: PDFFont;
  bold!: PDFFont;
  boldItalic!: PDFFont;
  serifItalic!: PDFFont;
  logo: PDFImage | null = null;
  fill: Fill = NO_FILL;
  page!: PDFPage;
  /** Top of the free space on the current page (PDF y grows upwards). */
  y = 0;
  private supported!: Set<number>;

  constructor(doc: PDFDocument, public pageH: number = PAGE_H) {
    this.doc = doc;
  }

  async init(withPage = true) {
    this.regular = await this.doc.embedFont(StandardFonts.Helvetica);
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.boldItalic = await this.doc.embedFont(StandardFonts.HelveticaBoldOblique);
    this.serifItalic = await this.doc.embedFont(StandardFonts.TimesRomanItalic);
    this.supported = new Set(this.regular.getCharacterSet());
    try {
      this.logo = await this.doc.embedPng(Buffer.from(LOGO_PNG_BASE64, 'base64'));
    } catch {
      this.logo = null; // the logo must never stop an invoice from rendering
    }
    if (withPage) this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, this.pageH]);
    this.y = this.pageH - px(16);
  }

  /** Text the font can draw: unknown characters get a fallback or a "?". */
  safe(value: string): string {
    return [...value]
      .map((ch) => {
        const code = ch.codePointAt(0)!;
        if (code === 9) return ' ';
        if (code === 10 || code === 13) return ch; // line breaks are handled by the wrapping
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

  /** Width of upper-cased, letter-spaced text (PDF text has no letter-spacing of its own, so each letter is placed). */
  spacedWidth(value: string, size: number, spacing: number, font = this.bold) {
    const chars = [...this.safe(value)];
    return chars.reduce((sum, ch) => sum + font.widthOfTextAtSize(ch, size), 0) + spacing * Math.max(0, chars.length - 1);
  }

  spaced(value: string, x: number, top: number, size: number, spacing: number, opts: { font?: PDFFont; color?: RGB; align?: 'left' | 'right'; boxWidth?: number } = {}) {
    const font = opts.font ?? this.bold;
    const chars = [...this.safe(value)];
    const total = this.spacedWidth(value, size, spacing, font);
    let cursor = x + (opts.align === 'right' ? (opts.boxWidth ?? 0) - total : 0);
    for (const ch of chars) {
      this.page.drawText(ch, { x: cursor, y: top - size, font, size, color: opts.color ?? INK });
      cursor += font.widthOfTextAtSize(ch, size) + spacing;
    }
  }

  /** A filled and/or outlined rectangle with its own radius on each corner. `top` is its top edge. */
  shape(x: number, top: number, width: number, height: number, radius: number | Radii, style: { fill?: RGB; stroke?: RGB; strokeWidth?: number }) {
    const [tl, tr, br, bl] = typeof radius === 'number' ? ([radius, radius, radius, radius] as Radii) : radius;
    const corner = (r: number, toX: number, toY: number) => (r > 0 ? `A ${r} ${r} 0 0 1 ${toX} ${toY}` : `L ${toX} ${toY}`);
    const path = [
      `M ${tl} 0`, `L ${width - tr} 0`, corner(tr, width, tr),
      `L ${width} ${height - br}`, corner(br, width - br, height),
      `L ${bl} ${height}`, corner(bl, 0, height - bl),
      `L 0 ${tl}`, corner(tl, tl, 0), 'Z',
    ].join(' ');
    this.page.drawSvgPath(path, {
      x,
      y: top,
      borderWidth: style.strokeWidth ?? 0,
      ...(style.fill ? { color: style.fill } : {}),
      ...(style.stroke ? { borderColor: style.stroke } : {}),
    });
  }
}

const lineH = (size: number) => size * 1.38;

/** The value of one of the invoice's labelled fields (blank when absent). */
function fieldValue(fields: DocField[], label: string): string {
  return fields.find((f) => f.label === label)?.value ?? '';
}

// ------------------------------------------------------------------ header

function header(w: Writer, doc: InvoiceDocument) {
  const bandTop = w.pageH;
  w.page.drawRectangle({ x: 0, y: bandTop - BAND_H, width: PAGE_W, height: BAND_H, color: PRIMARY });
  w.page.drawRectangle({ x: 0, y: bandTop - BAND_H - STRIP_H, width: PAGE_W, height: STRIP_H, color: ACCENT });
  const mid = bandTop - BAND_H / 2;

  // logo and company name, left
  const logoH = px(94);
  const logoW = w.logo ? (logoH * LOGO_WIDTH) / LOGO_HEIGHT : 0;
  if (w.logo) w.page.drawImage(w.logo, { x: MARGIN, y: mid - logoH / 2, width: logoW, height: logoH });
  const textX = MARGIN + (w.logo ? logoW + px(20) : 0);
  const right = PAGE_W - MARGIN;

  // invoice label, number and date, right: the number shrinks if it is long, so it never runs into the company name
  const label = doc.kindLabel ? `INVOICE · ${doc.kindLabel}` : 'INVOICE';
  let numSize = px(34);
  const maxNumW = (right - MARGIN) * 0.4;
  while (w.width(doc.invoiceNumber, numSize, w.bold) > maxNumW && numSize > px(16)) numSize -= px(1);
  const rightW = Math.max(w.width(doc.invoiceNumber, numSize, w.bold), w.spacedWidth(label, px(15), px(3)), w.width(doc.invoiceDate, px(15)));
  const stackH = px(15) + px(6) + numSize + px(4) + px(15);
  const stackTop = mid + stackH / 2;
  w.spaced(label, 0, stackTop, px(15), px(3), { font: w.bold, color: ON_BAND, align: 'right', boxWidth: right });
  w.text(doc.invoiceNumber, 0, stackTop - px(21), numSize, { font: w.bold, color: WHITE, align: 'right', boxWidth: right });
  w.text(doc.invoiceDate, 0, stackTop - px(21) - numSize - px(4), px(15), { color: ON_BAND_SOFT, align: 'right', boxWidth: right });

  // company name: gets whatever room the number leaves, gets smaller, and wraps onto a second line when it still does not fit
  const maxName = right - rightW - px(28) - textX;
  const name = doc.exporter.name.toUpperCase();
  let nameSize = px(24);
  while (w.width(name, nameSize, w.boldItalic) > maxName && nameSize > px(17)) nameSize -= px(1);
  const nameLines = w.width(name, nameSize, w.boldItalic) > maxName ? w.wrap(name, nameSize, maxName, w.boldItalic).slice(0, 2) : [name];
  const tagSize = px(12);
  const nameH = nameLines.length * nameSize * 1.08;
  const blockTop = mid + (nameH + px(8) + tagSize) / 2;
  nameLines.forEach((line, i) => w.text(line, textX, blockTop - i * nameSize * 1.08, nameSize, { font: w.boldItalic, color: WHITE }));
  w.text(TAGLINE, textX, blockTop - nameH - px(8), tagSize, { font: w.serifItalic, color: ON_BAND_SOFT });
  w.y = bandTop - BAND_H - STRIP_H - px(16);
}

// ------------------------------------------------------------------ exporter / importer

interface Para { text: string; size: number; font: PDFFont; color: RGB; before: number }

function partyParas(w: Writer, p: DocParty, innerW: number, buyer?: string): Para[] {
  const paras: Para[] = [];
  paras.push({ text: p.name, size: px(13.5), font: w.bold, color: INK, before: px(3) });
  p.details.forEach((d) => w.wrap(d, px(10.5), innerW).forEach((l, i) => paras.push({ text: l, size: px(10.5), font: w.regular, color: MUTED, before: i === 0 && paras.length === 1 ? px(2) : 0 })));
  if (buyer) {
    paras.push({ text: 'Buyer (If other than consignee)', size: px(10.5), font: w.regular, color: MUTED, before: px(6) });
    w.wrap(buyer, px(10.5), innerW, w.bold).forEach((l) => paras.push({ text: l, size: px(10.5), font: w.bold, color: INK, before: 0 }));
  }
  return paras;
}

const parasHeight = (paras: Para[]) => paras.reduce((sum, p) => sum + p.before + lineH(p.size), 0);

function parties(w: Writer, doc: InvoiceDocument) {
  const gap = px(14);
  const boxW = (CONTENT_W - gap) / 2;
  const padX = px(16);
  const padY = px(12);
  const innerW = boxW - padX * 2;
  const left = partyParas(w, doc.exporter, innerW);
  const right = partyParas(w, doc.importer, innerW, doc.buyer);
  const labelH = px(8.5) + px(4);
  const height = padY * 2 + labelH + Math.max(parasHeight(left), parasHeight(right));
  const top = w.y;
  const draw = (x: number, title: string, paras: Para[]) => {
    w.shape(x, top, boxW, height, px(12), { fill: TINT });
    w.spaced(title.toUpperCase(), x + padX, top - padY, px(8.5), px(1.4), { color: PRIMARY });
    let cursor = top - padY - labelH;
    paras.forEach((p) => { cursor -= p.before; w.text(p.text, x + padX, cursor, p.size, { font: p.font, color: p.color }); cursor -= lineH(p.size); });
  };
  draw(MARGIN, 'From · Exporter', left);
  draw(MARGIN + boxW + gap, 'To · Importer / consignee', right);
  w.y = top - height - px(12) - w.fill.gap;
}

// ------------------------------------------------------------------ shipment details

function shipment(w: Writer, doc: InvoiceDocument) {
  const ship = (label: string) => fieldValue(doc.shipping, label);
  const goods = (label: string) => fieldValue(doc.goods, label);
  const ref = (label: string) => fieldValue(doc.references, label);
  const cells: [string, string][] = [
    ['Pre-carriage by', ship('Pre-Carriage by')], ['Place of receipt', ship('Place of Receipt by Pre-Carrier')], ["Exporter's ref.", ref("Exporter's Ref.")], ['AWB no.', ref('AWB No.')],
    ['Vessel / flight no.', ship('Vessel / Flight No.')], ['Port of loading', ship('Port of Loading')], ["Buyer's order no. & date", ref("Buyer's Order No. & Date")], ['Other reference(s)', ref('Other Reference(s)')],
    ['Port of discharge', ship('Port of Discharge')], ['Final destination', ship('Final Destination')], ['Country of origin', ship('Country of Origin')], ['Country of destination', ship('Country of Destination')],
    ['Description of goods', goods('Description of Goods')], ['HS code', goods('HS Code')], ['Terms of delivery', goods('Terms of Delivery')], ['Terms of payment', goods('Terms of Payment')],
  ];
  const padX = px(18);
  const padY = px(14);
  const colGap = px(18);
  const rowGap = px(11) + w.fill.cell;
  const cellW = (CONTENT_W - padX * 2 - colGap * 3) / 4;
  const labelSize = px(7.5);
  const valueSize = px(10.5);
  const rows = [0, 1, 2, 3].map((r) => {
    const row = cells.slice(r * 4, r * 4 + 4).map(([label, value]) => ({ label: label.toUpperCase(), lines: w.wrap(value, valueSize, cellW, w.bold) }));
    return { row, height: px(10.5) + Math.max(...row.map((c) => c.lines.length), 1) * lineH(valueSize) };
  });
  const height = padY * 2 + rows.reduce((sum, r) => sum + r.height, 0) + rowGap * 3;
  const top = w.y;
  w.shape(MARGIN, top, CONTENT_W, height, px(12), { fill: TINT });
  let cursor = top - padY;
  rows.forEach(({ row, height: rowH }) => {
    row.forEach((cell, c) => {
      const x = MARGIN + padX + c * (cellW + colGap);
      // a long label gets a little smaller instead of running into its neighbour
      let size = labelSize;
      let spacing = px(1);
      while (w.spacedWidth(cell.label, size, spacing) > cellW && spacing > 0) spacing = Math.max(0, spacing - px(0.25));
      while (w.spacedWidth(cell.label, size, spacing) > cellW && size > px(6)) size -= px(0.25);
      w.spaced(cell.label, x, cursor, size, spacing, { color: PRIMARY });
      cell.lines.forEach((line, i) => w.text(line, x, cursor - px(10.5) - i * lineH(valueSize), valueSize, { font: w.bold }));
    });
    cursor -= rowH + rowGap;
  });
  w.y = top - height - px(12) - w.fill.gap;
}

// ------------------------------------------------------------------ product table

interface Col { title: string; width: number; align: 'left' | 'right' }

/** Compact numbers: 2 -> "2", 2.5 -> "2.5", 1234.5 -> "1,234.5". */
const compact = (value: number) => (Number.isInteger(value) ? value.toLocaleString('en-US') : formatNumber(value).replace(/0+$/, '').replace(/\.$/, ''));

function itemsTable(w: Writer, doc: InvoiceDocument) {
  // the description gets a modest share and the number columns room to breathe (widths in design px, 690 in all)
  const cols: Col[] = [
    { title: '#', width: 24, align: 'left' },
    { title: 'Marks & nos · container', width: 82, align: 'left' },
    { title: 'Description of goods', width: 150, align: 'left' },
    { title: 'Nett wt / pkg', width: 74, align: 'right' },
    { title: 'Boxes', width: 48, align: 'right' },
    { title: 'Total nett wt', width: 66, align: 'right' },
    { title: 'Rate / kg', width: 60, align: 'right' },
    { title: 'Total / box', width: 90, align: 'right' },
    { title: 'Amount', width: 96, align: 'right' },
  ];
  const widths = cols.map((c) => px(c.width));
  const total = widths.reduce((s, x) => s + x, 0);
  const scale = CONTENT_W / total;
  const colW = widths.map((x) => x * scale);
  const pad = px(4);
  const frame = px(1.5);
  // fewer lines get roomier rows; the invoice is scaled to one page anyway when it is long
  const n = doc.lines.length;
  const rowPad = (n <= 12 ? px(5) : n <= 24 ? px(4) : px(2.5)) + w.fill.pad;
  const cur = doc.currency;

  const headSize = px(7.5);
  const headLines = cols.map((c, i) => w.wrap(c.title.toUpperCase(), headSize, colW[i]! - pad * 2, w.bold));
  const headH = px(7) * 2 + Math.max(...headLines.map((l) => l.length)) * headSize * 1.3;

  const top = w.y;
  const r = px(10);
  // header row: green, with the Amount column in the accent colour
  w.shape(MARGIN, top, CONTENT_W - colW[8]!, headH, [r, 0, 0, 0], { fill: PRIMARY });
  w.shape(MARGIN + CONTENT_W - colW[8]!, top, colW[8]!, headH, [0, r, 0, 0], { fill: ACCENT });
  let x = MARGIN;
  cols.forEach((c, i) => {
    const color = i === 8 ? ON_ACCENT : WHITE;
    headLines[i]!.forEach((line, li) => w.spaced(line, x + pad, top - px(7) - li * headSize * 1.3, headSize, px(0.75), { color, align: c.align === 'right' ? 'right' : 'left', boxWidth: colW[i]! - pad * 2 }));
    x += colW[i]!;
  });

  // The unit (KGS or the currency) is placed just left of the widest number in its column, so the units form one straight line
  // down the table and stay close to their numbers instead of drifting to the cell edge.
  const body = px(10);
  const unitGap = px(5);
  const numberText = [
    (l: InvoiceDocument['lines'][number]) => formatNumber(l.nettPerPackage),
    (l: InvoiceDocument['lines'][number]) => formatNumber(l.totalPerBox),
    (l: InvoiceDocument['lines'][number]) => formatNumber(l.amount),
  ];
  const widest = [3, 7, 8].map((_, k) => Math.max(0, ...doc.lines.map((l) => w.width(numberText[k]!(l), body, k === 2 ? w.bold : w.regular))));
  const unitX = (colIndex: 3 | 7 | 8) => {
    const k = colIndex === 3 ? 0 : colIndex === 7 ? 1 : 2;
    let x = MARGIN;
    for (let c = 0; c < colIndex; c++) x += colW[c]!;
    return x + colW[colIndex]! - pad - widest[k]! - unitGap;
  };

  let cursor = top - headH;
  doc.lines.forEach((line, index) => {
    const marks = w.wrap(line.marks, body, colW[1]! - pad * 2);
    const desc = w.wrap(line.description, body, colW[2]! - pad * 2);
    const rowH = rowPad * 2 + Math.max(marks.length, desc.length, 1) * lineH(body);
    const last = index === n - 1;
    if (index % 2 === 1) w.shape(MARGIN, cursor, CONTENT_W, rowH, last ? [0, 0, r, r] : 0, { fill: TINT });
    w.page.drawLine({ start: { x: MARGIN, y: cursor }, end: { x: MARGIN + CONTENT_W, y: cursor }, thickness: px(1), color: TINT_STRONG });
    const cells: { lines: string[]; font: PDFFont; color: RGB; unit?: string }[] = [
      { lines: [String(line.no)], font: w.regular, color: FAINT },
      { lines: marks, font: w.regular, color: MUTED },
      { lines: desc, font: w.regular, color: INK },
      { lines: [formatNumber(line.nettPerPackage)], font: w.regular, color: INK, unit: 'KGS' },
      { lines: [String(line.boxes)], font: w.regular, color: INK },
      { lines: [compact(line.totalNett)], font: w.regular, color: INK },
      { lines: [formatNumber(line.rate)], font: w.regular, color: INK },
      { lines: [formatNumber(line.totalPerBox)], font: w.regular, color: INK, unit: cur },
      { lines: [formatNumber(line.amount)], font: w.bold, color: INK, unit: cur },
    ];
    let cx = MARGIN;
    cells.forEach((cell, i) => {
      // every cell is centred in the row, so one-line numbers sit level with the first line of a wrapped description
      const blockH = cell.lines.length * lineH(body);
      const first = cursor - (rowH - blockH) / 2 + (lineH(body) - body) / 2 - 0.5;
      cell.lines.forEach((t, li) => w.text(t, cx + pad, first - li * lineH(body), body, { font: cell.font, color: cell.color, align: cols[i]!.align, boxWidth: colW[i]! - pad * 2 }));
      // the unit sits just left of the widest number of its column, so the units line up down the table
      if (cell.unit) w.text(cell.unit, unitX(i as 3 | 7 | 8) - w.width(cell.unit, body, cell.font), first, body, { font: cell.font, color: cell.color });
      cx += colW[i]!;
    });
    cursor -= rowH;
  });
  // the rounded frame goes over the rows
  w.shape(MARGIN + frame / 2, top - frame / 2, CONTENT_W - frame, top - cursor - frame, r, { stroke: TINT_STRONG, strokeWidth: frame });
  w.y = cursor - px(12) - w.fill.gap;
}

// ------------------------------------------------------------------ totals, bank, declaration, signature

function summary(w: Writer, doc: InvoiceDocument) {
  const gap = px(14);
  const colW = (CONTENT_W - gap) / 2;
  const cur = doc.currency;
  const roundOff = Math.round((doc.totals.total - doc.totals.subTotal) * 100) / 100;

  // left: the three weights, then the amount in words
  const weights: [string, string][] = [
    ['No. of packages', String(doc.totals.packages)],
    ['Total nett weight', `${formatNumber(doc.totals.nettWeight)} KGS`],
    ['Total gross weight', doc.totals.grossWeight !== null ? `${formatNumber(doc.totals.grossWeight)} KGS` : ''],
  ];
  const weightsH = px(10) * 2 + px(7.5) * 1.4 + px(3) + px(13) * 1.25;
  const wordsText = doc.amountInWords ? `(${cur}) ${doc.amountInWords}` : '';
  const wordsLines = w.wrap(wordsText, px(12.5), colW - px(28), w.bold);
  const wordsH = px(10) * 2 + px(8.5) + px(4) + Math.max(1, wordsLines.length) * lineH(px(12.5));
  const leftH = weightsH + px(12) + wordsH;

  // right: sub total, round off and the Total pill
  const pillH = px(11) * 2 + px(15) * 1.25;
  const rowsH = 2 * lineH(px(10.5)) + px(4);
  const rightH = px(10) * 2 + rowsH + px(4) + pillH;
  const height = Math.max(leftH, rightH);
  const top = w.y;

  // weights box
  w.shape(MARGIN, top, colW, weightsH, px(12), { fill: TINT });
  const cellW = (colW - px(28) - px(20)) / 3;
  weights.forEach(([label, value], i) => {
    const x = MARGIN + px(14) + i * (cellW + px(10));
    w.spaced(label.toUpperCase(), x, top - px(10), px(7.5), px(0.45), { color: PRIMARY });
    w.text(value, x, top - px(10) - px(7.5) * 1.4 - px(3), px(13), { font: w.bold });
  });
  // amount in words fills the rest of the left column
  const wordsTop = top - weightsH - px(12);
  const wordsBoxH = height - weightsH - px(12);
  w.shape(MARGIN, wordsTop, colW, wordsBoxH, px(12), { fill: TINT });
  w.spaced('AMOUNT IN WORDS', MARGIN + px(14), wordsTop - px(10), px(8.5), px(1.4), { color: PRIMARY });
  wordsLines.forEach((line, i) => w.text(line, MARGIN + px(14), wordsTop - px(10) - px(8.5) - px(4) - i * lineH(px(12.5)), px(12.5), { font: w.bold }));

  // totals box
  const rx = MARGIN + colW + gap;
  w.shape(rx, top, colW, height, px(12), { fill: TINT });
  const rowY = top - px(10);
  w.text('Sub total', rx + px(12), rowY, px(10.5), { color: MUTED });
  w.text(formatNumber(doc.totals.subTotal), rx + px(12), rowY, px(10.5), { align: 'right', boxWidth: colW - px(24) });
  w.text('Round off', rx + px(12), rowY - lineH(px(10.5)) - px(4), px(10.5), { color: MUTED });
  w.text(roundOff === 0 ? '' : formatNumber(roundOff), rx + px(12), rowY - lineH(px(10.5)) - px(4), px(10.5), { align: 'right', boxWidth: colW - px(24) });
  const pillTop = top - height + px(10) + pillH;
  w.shape(rx + px(12), pillTop, colW - px(24), pillH, px(10), { fill: ACCENT });
  w.text('Total', rx + px(26), pillTop - px(11) - px(1), px(15), { font: w.bold, color: ON_ACCENT });
  w.text(`${cur} ${formatNumber(doc.totals.total)}`, rx + px(26), pillTop - px(11) - px(1), px(15), { font: w.bold, color: ON_ACCENT, align: 'right', boxWidth: colW - px(52) });
  w.y = top - height - px(12) - w.fill.gap;
}

async function bottom(w: Writer, doc: InvoiceDocument) {
  const gap = px(14);
  const colW = (CONTENT_W - gap) / 2;
  const pad = px(14);

  // bank details in two columns and two rows
  const bank = (label: string) => fieldValue(doc.bank, label);
  const bankCells: [string, string][] = [['Bank name', bank('Bank Name')], ['Account number', bank('Account Number')], ['IFSC code', bank('IFSC Code')], ['SWIFT code', bank('SWIFT Code')]];
  const bankCellW = (colW - pad * 2 - px(18)) / 2;
  const bankRowH = px(7.5) * 1.4 + px(11.5) * 1.35;
  const bankH = px(10) * 2 + px(8.5) + px(4) + bankRowH * 2 + px(8);
  const declLines = w.wrap(doc.declaration, px(10), colW - pad * 2);
  const declH = px(10) * 2 + px(8.5) + px(4) + declLines.length * lineH(px(10));
  const leftH = bankH + px(12) + declH;
  const top = w.y;

  w.shape(MARGIN, top, colW, bankH, px(12), { fill: TINT });
  w.spaced('BANK DETAILS', MARGIN + pad, top - px(10), px(8.5), px(1.4), { color: PRIMARY });
  bankCells.forEach(([label, value], i) => {
    const x = MARGIN + pad + (i % 2) * (bankCellW + px(18));
    const y = top - px(10) - px(8.5) - px(4) - Math.floor(i / 2) * (bankRowH + px(8));
    w.spaced(label.toUpperCase(), x, y, px(7.5), px(1), { color: PRIMARY });
    w.wrap(value, px(11.5), bankCellW, w.bold).slice(0, 1).forEach((line) => w.text(line, x, y - px(7.5) * 1.4, px(11.5), { font: w.bold }));
  });

  const declTop = top - bankH - px(12);
  w.shape(MARGIN, declTop, colW, declH, px(12), { fill: TINT });
  w.spaced('DECLARATION', MARGIN + pad, declTop - px(10), px(8.5), px(1.4), { color: PRIMARY });
  declLines.forEach((line, i) => w.text(line, MARGIN + pad, declTop - px(10) - px(8.5) - px(4) - i * lineH(px(10)), px(10), { color: MUTED }));

  // signature: centred in the free space on the right
  let image: PDFImage | null = null;
  if (doc.sign) {
    try {
      image = doc.sign.mime === 'image/png' ? await w.doc.embedPng(doc.sign.bytes) : await w.doc.embedJpg(doc.sign.bytes);
    } catch {
      image = null; // a damaged image must never stop the PDF
    }
  }
  const fit = image ? Math.min(px(210) / image.width, px(86) / image.height) : 0;
  const imgW = image ? image.width * fit : 0;
  const imgH = image ? image.height * fit : 0;
  const imgBox = Math.max(imgH, px(50));
  const signBlockH = imgBox + px(4) + px(9) * 1.4 + px(4);
  const lineW = Math.min(colW, px(190));
  const stackH = Math.max(leftH, signBlockH);
  const sx = MARGIN + colW + gap;
  const blockTop = top - (stackH - signBlockH) / 2;
  if (image) w.page.drawImage(image, { x: sx + (colW - imgW) / 2, y: blockTop - imgBox + (imgBox - imgH) / 2, width: imgW, height: imgH });
  const lineY = blockTop - imgBox - px(4);
  const lineX = sx + (colW - lineW) / 2;
  w.page.drawLine({ start: { x: lineX, y: lineY }, end: { x: lineX + lineW, y: lineY }, thickness: px(0.9), color: INK });
  w.text('Seal & Sign', sx, lineY - px(4), px(9), { color: MUTED, align: 'center', boxWidth: colW });
  w.y = top - stackH - px(6);
}

/** Footer on the pages of one invoice (`from` up to but not including `to`): its number, exporter and "Page x of y" within that invoice. */
function footers(w: Writer, doc: InvoiceDocument, from: number, to: number) {
  const all = w.doc.getPages();
  const pages = all.slice(from, to);
  pages.forEach((page, i) => {
    page.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: PAGE_W - MARGIN, y: 38 }, thickness: 0.5, color: TINT_STRONG });
    const left = w.safe(`Invoice ${doc.invoiceNumber}  |  ${doc.exporter.name}`);
    page.drawText(left, { x: MARGIN, y: 26, size: 7.5, font: w.regular, color: FAINT });
    const right = `Page ${from + i + 1} of ${all.length}`;
    page.drawText(right, { x: PAGE_W - MARGIN - w.regular.widthOfTextAtSize(right, 7.5), y: 26, size: 7.5, font: w.regular, color: FAINT });
  });
}

/** Height of the tall scratch page an invoice is first drawn on, so it never has to break onto a second page while being measured. */
const MEASURE_H = 20_000;
/** Extra virtual room below an invoice: a section can reserve more space than it ends up using, and must never start a second page because of it. */
const RESERVE_SLACK = 300;

/** How tall an invoice is when drawn in one piece (from the top of the page down to its last line). */
async function measure(doc: InvoiceDocument, fill: Fill = NO_FILL): Promise<number> {
  const scratch = await PDFDocument.create();
  const w = new Writer(scratch, MEASURE_H);
  await w.init();
  w.fill = fill;
  w.y = MEASURE_H;
  await drawDocument(w, doc);
  return MEASURE_H - (w.y - 6);
}

/** How much extra room to give a short invoice so it fills the page: a little for a medium one, more for a small one. */
async function fitFill(doc: InvoiceDocument): Promise<{ fill: Fill; contentH: number }> {
  const natural = await measure(doc);
  const target = PAGE_H - BOTTOM - px(6);
  if (natural >= target) return { fill: NO_FILL, contentH: natural };
  const extra = target - natural;
  const n = Math.max(1, doc.lines.length);
  const fill: Fill = { pad: Math.min(px(22), (extra * 0.5) / (2 * n)), gap: Math.min(px(30), (extra * 0.3) / 4), cell: Math.min(px(12), (extra * 0.2) / 3) };
  let height = await measure(doc, fill);
  // spend what is left on the product rows
  if (height < target) {
    fill.pad = Math.min(px(30), fill.pad + (target - height) / (2 * n));
    height = await measure(doc, fill);
  }
  return { fill, contentH: height };
}

/**
 * Renders the structured invoice as an A4 PDF in the green and marigold layout, every invoice on exactly ONE page.
 * Each invoice is measured first. If it is taller than the page (a long product table) it is drawn again with everything
 * scaled down to fit, as ordinary page content (no embedded sub-pages, so every viewer and printer shows the text).
 * Several documents (a BOTH invoice) follow one another in one PDF, one page each.
 */
export async function renderInvoicePdf(input: InvoiceDocument | InvoiceDocument[]): Promise<Uint8Array> {
  const docs = Array.isArray(input) ? input : [input];
  const first = docs[0]!;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${first.invoiceNumber}`);
  pdf.setSubject(`Invoice from ${first.exporter.name} to ${first.importer.name}`);
  pdf.setCreator('Invoice Manager');
  const w = new Writer(pdf);
  await w.init(false);

  const placed: { doc: InvoiceDocument; index: number }[] = [];
  for (const doc of docs) {
    const { fill, contentH } = await fitFill(doc);
    w.fill = fill;
    const scale = Math.min(1, (PAGE_H - BOTTOM) / contentH);
    // The drawing code works in a "virtual" page a little taller than the content (room for the space some sections reserve
    // for themselves), and a transform maps it onto the A4 page: top-aligned, centred, scaled down when it is taller than the page.
    w.pageH = contentH + BOTTOM + 6 + RESERVE_SLACK;
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    w.page = page;
    w.y = w.pageH;

    if (scale < 1) {
      // a scaled-down invoice is narrower than the page, so the header band is extended to the page edges behind it
      page.drawRectangle({ x: 0, y: PAGE_H - BAND_H * scale, width: PAGE_W, height: BAND_H * scale, color: PRIMARY });
      page.drawRectangle({ x: 0, y: PAGE_H - (BAND_H + STRIP_H) * scale, width: PAGE_W, height: STRIP_H * scale, color: ACCENT });
    }
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(scale, 0, 0, scale, (PAGE_W - PAGE_W * scale) / 2, PAGE_H - scale * w.pageH));
    await drawDocument(w, doc);
    page.pushOperators(popGraphicsState());
    placed.push({ doc, index: pdf.getPageCount() - 1 });
  }
  // footers last, so "Page x of y" knows the final page count
  w.pageH = PAGE_H;
  for (const { doc, index } of placed) footers(w, doc, index, index + 1);
  return pdf.save();
}

async function drawDocument(w: Writer, doc: InvoiceDocument) {
  header(w, doc);
  parties(w, doc);
  shipment(w, doc);
  itemsTable(w, doc);
  summary(w, doc);
  await bottom(w, doc);
}

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';
import { LOGO_PNG_BASE64, TAGLINE } from '../assets/branding';
import type { PaymentStatus, Statement, StatementSection } from 'shared';
import { formatDate, formatNumber } from './invoice-document';

const W = 595.28;
const H = 841.89;
const M = 40;
const CONTENT = W - M * 2;
const FOOTER = 46;

const hex = (value: string): RGB => rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255);
const PRIMARY = hex('#1f5a3b');
const ACCENT = hex('#f2a516');
const TINT = hex('#eef6f0');
const TINT_STRONG = hex('#d4e5d9');
const INK = hex('#14291c');
const MUTED = hex('#46594d');
const RED = hex('#b42318');
const GREEN = hex('#1a7f4b');
const WHITE = rgb(1, 1, 1);

const FALLBACKS: Record<string, string> = { '₹': 'Rs', '€': 'EUR', '£': 'GBP', '“': '"', '”': '"', '‘': "'", '’': "'", '–': '-', '—': '-', '•': '*', '…': '...', '·': '-' };
const STATUS_LABEL: Record<PaymentStatus, string> = { unpaid: 'Unpaid', partial: 'Part paid', paid: 'Paid', overpaid: 'Overpaid' };

const day = (iso: string) => formatDate(new Date(`${iso}T00:00:00.000Z`));

/** A statement of account as a PDF: who owes what, per currency, with every invoice and payment in date order. */
export async function renderStatementPdf(statement: Statement): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Statement of account - ${statement.importer.name}`);
  doc.setCreator('Invoice Manager');
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(regular.getCharacterSet());
  let logo: PDFImage | null = null;
  try { logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, 'base64')); } catch { logo = null; }

  const safe = (value: string) => [...value].map((ch) => (supported.has(ch.codePointAt(0)!) ? ch : FALLBACKS[ch] ?? '?')).join('');
  let page!: PDFPage;
  let top = 0; // distance from the top of the page to the next free line

  const text = (value: string, x: number, size: number, opts: { font?: PDFFont; color?: RGB; align?: 'left' | 'right'; width?: number } = {}) => {
    const font = opts.font ?? regular;
    let out = safe(value);
    const box = opts.width ?? 0;
    // text that does not fit its column is cut short with "..."
    if (box && font.widthOfTextAtSize(out, size) > box) {
      while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > box) out = out.slice(0, -1);
      out = `${out}...`;
    }
    const w = font.widthOfTextAtSize(out, size);
    page.drawText(out, { x: opts.align === 'right' ? x + box - w : x, y: H - top - size, font, size, color: opts.color ?? INK });
  };
  const rect = (x: number, yTop: number, w: number, h: number, color: RGB) => page.drawRectangle({ x, y: H - yTop - h, width: w, height: h, color });
  const line = (yTop: number, color = TINT_STRONG) => page.drawLine({ start: { x: M, y: H - yTop }, end: { x: W - M, y: H - yTop }, thickness: 0.6, color });

  const firstPage = () => {
    page = doc.addPage([W, H]);
    rect(0, 0, W, 86, PRIMARY);
    rect(0, 86, W, 4, ACCENT);
    let textX = M;
    if (logo) {
      const h = 54;
      const w = (logo.width / logo.height) * h;
      page.drawImage(logo, { x: M, y: H - 20 - h, width: w, height: h });
      textX = M + w + 14;
    }
    top = 24;
    text('STATEMENT OF ACCOUNT', textX, 19, { font: bold, color: WHITE });
    top = 50;
    text(TAGLINE, textX, 9, { color: hex('#c7d7cd') });
    const period = statement.from || statement.to ? `${statement.from ? day(statement.from) : 'Start'} to ${statement.to ? day(statement.to) : 'today'}` : 'All dates';
    top = 30;
    text(period, W - M - 240, 10, { font: bold, color: WHITE, align: 'right', width: 240 });
    top = 46;
    text(`Prepared ${day(statement.generatedOn)}`, W - M - 240, 9, { color: hex('#c7d7cd'), align: 'right', width: 240 });
    top = 108;
  };
  const nextPage = () => {
    page = doc.addPage([W, H]);
    rect(0, 0, W, 6, PRIMARY);
    top = 28;
    text(`Statement of account - ${statement.importer.name}`, M, 9, { color: MUTED });
    top = 46;
  };
  const ensure = (height: number) => { if (top + height > H - FOOTER) nextPage(); };

  firstPage();
  // ---- who the statement is for
  text('Statement for', M, 8.5, { color: MUTED });
  top += 12;
  text(statement.importer.name, M, 15, { font: bold });
  top += 20;
  for (const part of [statement.importer.address, statement.importer.contact, statement.importer.email].filter((p): p is string => !!p)) {
    for (const l of safe(part).split(/\r?\n/)) { text(l, M, 9.5, { color: MUTED, width: CONTENT }); top += 12.5; }
  }
  top += 10;

  if (statement.sections.length === 0) {
    rect(M, top, CONTENT, 60, TINT);
    top += 24;
    text('There are no actual invoices or payments for this importer in this period.', M + 16, 10.5, { color: MUTED });
    top += 60;
  }

  for (const section of statement.sections) drawSection(section);

  function drawSection(section: StatementSection) {
    ensure(150);
    rect(M, top, CONTENT, 22, PRIMARY);
    top += 6;
    text(`Account in ${section.currency}`, M + 10, 11, { font: bold, color: WHITE });
    top += 24;

    // the four figures that matter
    const boxW = (CONTENT - 3 * 8) / 4;
    const boxes: [string, string, RGB][] = [
      ['Balance brought forward', formatNumber(section.opening), INK],
      ['Invoiced', formatNumber(section.invoiced), INK],
      ['Received', formatNumber(section.received), GREEN],
      ['Balance due', formatNumber(section.closing), section.closing > 0.005 ? RED : GREEN],
    ];
    boxes.forEach(([label, value, color], i) => {
      const x = M + i * (boxW + 8);
      rect(x, top, boxW, 44, i === 3 ? TINT_STRONG : TINT);
      const saved = top;
      top = saved + 8;
      text(label.toUpperCase(), x + 8, 6.5, { color: MUTED });
      top = saved + 21;
      text(`${section.currency} ${value}`, x + 8, 11.5, { font: bold, color, width: boxW - 16 });
      top = saved;
    });
    top += 56;

    // ---- every invoice and payment, in date order
    const cols = { date: M, ref: M + 62, desc: M + 160, debit: M + 330, credit: M + 396, bal: M + 456 };
    const widths = { date: 60, ref: 96, desc: 166, debit: 60, credit: 60, bal: 59 };
    const header = () => {
      rect(M, top, CONTENT, 18, TINT_STRONG);
      top += 5;
      text('DATE', cols.date + 6, 7, { font: bold, color: MUTED });
      text('INVOICE', cols.ref, 7, { font: bold, color: MUTED });
      text('DETAILS', cols.desc, 7, { font: bold, color: MUTED });
      text('INVOICED', cols.debit, 7, { font: bold, color: MUTED, align: 'right', width: widths.debit });
      text('RECEIVED', cols.credit, 7, { font: bold, color: MUTED, align: 'right', width: widths.credit });
      text('BALANCE', cols.bal, 7, { font: bold, color: MUTED, align: 'right', width: widths.bal - 4 });
      top += 17;
    };
    ensure(60);
    header();
    const row = (cells: { date?: string | undefined; ref?: string | undefined; desc?: string | undefined; debit?: number | undefined; credit?: number | undefined; bal?: number | undefined }, strong = false, tint = false) => {
      if (top + 17 > H - FOOTER) { nextPage(); header(); }
      if (tint) rect(M, top - 3, CONTENT, 17, TINT);
      const font = strong ? bold : regular;
      if (cells.date) text(cells.date, cols.date + 6, 8.5, { font, width: widths.date });
      if (cells.ref) text(cells.ref, cols.ref, 8.5, { font, width: widths.ref });
      if (cells.desc) text(cells.desc, cols.desc, 8.5, { font, color: strong ? INK : MUTED, width: widths.desc });
      if (cells.debit) text(formatNumber(cells.debit), cols.debit, 8.5, { font, align: 'right', width: widths.debit });
      if (cells.credit) text(formatNumber(cells.credit), cols.credit, 8.5, { font, color: GREEN, align: 'right', width: widths.credit });
      if (cells.bal !== undefined) text(formatNumber(cells.bal), cols.bal, 8.5, { font: bold, align: 'right', width: widths.bal - 4 });
      top += 16;
    };
    if (section.opening !== 0 || statement.from) row({ desc: 'Balance brought forward', bal: section.opening }, true, true);
    section.rows.forEach((r, i) => row({ date: day(r.date), ref: r.reference, desc: r.description, debit: r.debit || undefined, credit: r.credit || undefined, bal: r.balance }, false, i % 2 === 1));
    if (section.rows.length === 0) row({ desc: 'Nothing in this period' });
    line(top - 2, PRIMARY);
    top += 4;
    row({ desc: 'Balance due', debit: section.invoiced || undefined, credit: section.received || undefined, bal: section.closing }, true);
    top += 10;

    // ---- where each invoice stands
    if (section.invoices.length > 0) {
      ensure(60);
      text('INVOICES', M, 8, { font: bold, color: MUTED });
      top += 14;
      const ic = { no: M + 6, date: M + 170, total: M + 235, paid: M + 315, bal: M + 395, status: M + 470 };
      const head = () => {
        rect(M, top, CONTENT, 18, TINT_STRONG);
        top += 5;
        text('INVOICE', ic.no, 7, { font: bold, color: MUTED });
        text('DATE', ic.date, 7, { font: bold, color: MUTED });
        text('TOTAL', ic.total, 7, { font: bold, color: MUTED, align: 'right', width: 70 });
        text('PAID', ic.paid, 7, { font: bold, color: MUTED, align: 'right', width: 70 });
        text('BALANCE', ic.bal, 7, { font: bold, color: MUTED, align: 'right', width: 70 });
        text('STATUS', ic.status, 7, { font: bold, color: MUTED });
        top += 17;
      };
      head();
      section.invoices.forEach((inv, i) => {
        if (top + 17 > H - FOOTER) { nextPage(); head(); }
        if (i % 2 === 1) rect(M, top - 3, CONTENT, 17, TINT);
        text(inv.number, ic.no, 8.5, { width: 160 });
        text(day(inv.date), ic.date, 8.5, { color: MUTED });
        text(formatNumber(inv.total), ic.total, 8.5, { align: 'right', width: 70 });
        text(formatNumber(inv.paid), ic.paid, 8.5, { align: 'right', width: 70, color: GREEN });
        text(formatNumber(inv.balance), ic.bal, 8.5, { font: bold, align: 'right', width: 70, color: inv.balance > 0.005 ? RED : INK });
        text(STATUS_LABEL[inv.status], ic.status, 8.5, { font: bold, color: inv.status === 'paid' ? GREEN : inv.status === 'unpaid' ? RED : INK });
        top += 16;
      });
    }
    top += 18;
  }

  // page numbers last, so each knows the total
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 34 }, end: { x: W - M, y: 34 }, thickness: 0.6, color: TINT_STRONG });
    p.drawText(safe(`${statement.importer.name} - statement of account`), { x: M, y: 22, size: 8, font: regular, color: MUTED });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: W - M - regular.widthOfTextAtSize(label, 8), y: 22, size: 8, font: regular, color: MUTED });
  });
  return doc.save();
}

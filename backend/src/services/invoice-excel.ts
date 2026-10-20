import ExcelJS from 'exceljs';
import { LOGO_PNG_BASE64, TAGLINE } from '../assets/branding';
import type { DocField, DocParty, InvoiceDocument } from './invoice-document';

/** The green and marigold look of the PDF, in Excel colours. */
const PRIMARY = 'FF1F5A3B';
const ACCENT = 'FFF2A516';
const ON_ACCENT = 'FF2B1D00';
const TINT = 'FFEEF6F0';
const TINT_STRONG = 'FFD4E5D9';
const INK = 'FF14291C';
const MUTED = 'FF46594D';
const FAINT = 'FF5E7567';
const WHITE = 'FFFFFFFF';
const SOFT_WHITE = 'FFE3EDE7';

const LAST_COL = 'I';
const NUMBER_2 = '#,##0.00';
const GRID_LINE = { style: 'thin', color: { argb: TINT_STRONG } } as const;
const FRAME_LINE = { style: 'medium', color: { argb: TINT_STRONG } } as const;

const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

/** Rough row height for wrapped text in a merged range `chars` characters wide. */
function heightFor(text: string, chars: number, line = 15): number {
  const lines = text.split(/\r?\n/).reduce((n, part) => n + Math.max(1, Math.ceil(part.length / chars)), 0);
  return Math.max(line, lines * line);
}

/** Fills columns `from`..`to` (1-based) of a row. */
function fillRow(ws: ExcelJS.Worksheet, row: number, from: number, to: number, argb: string) {
  for (let c = from; c <= to; c++) ws.getRow(row).getCell(c).fill = solid(argb);
}

/** Merges `from`..`to` on a row (when it spans more than one column) and writes the value in the first cell. */
function put(ws: ExcelJS.Worksheet, row: number, from: number, to: number, value: ExcelJS.CellValue, style: { font?: Partial<ExcelJS.Font>; align?: Partial<ExcelJS.Alignment>; numFmt?: string }) {
  const a = ws.getColumn(from).letter;
  if (to > from) ws.mergeCells(`${a}${row}:${ws.getColumn(to).letter}${row}`);
  const cell = ws.getCell(`${a}${row}`);
  cell.value = value;
  if (style.font) cell.font = style.font;
  cell.alignment = { vertical: 'middle', indent: 1, ...(style.align ?? {}) };
  if (style.numFmt) cell.numFmt = style.numFmt;
  return cell;
}

const label = (size = 7.5): Partial<ExcelJS.Font> => ({ bold: true, size, color: { argb: PRIMARY } });

/** The exporter / importer block: tinted, a small label, the name, then the lines. Returns the number of rows it used. */
function partyBlock(ws: ExcelJS.Worksheet, row: number, from: number, to: number, title: string, p: DocParty, buyer: string | null, minRows: number): number {
  const items: { text: string; font: Partial<ExcelJS.Font> }[] = [
    { text: title.toUpperCase(), font: label(8) },
    { text: p.name, font: { bold: true, size: 12, color: { argb: INK } } },
    ...p.details.map((text) => ({ text, font: { size: 10, color: { argb: MUTED } } as Partial<ExcelJS.Font> })),
  ];
  if (buyer !== null && buyer !== '') {
    items.push({ text: 'Buyer (If other than consignee)', font: { size: 10, color: { argb: MUTED } } });
    items.push({ text: buyer, font: { bold: true, size: 10, color: { argb: INK } } });
  }
  while (items.length < minRows) items.push({ text: '', font: {} });
  items.forEach((item, i) => {
    fillRow(ws, row + i, from, to, TINT);
    put(ws, row + i, from, to, item.text, { font: item.font, align: { vertical: 'top', wrapText: true } });
    ws.getRow(row + i).height = Math.max(ws.getRow(row + i).height ?? 0, heightFor(item.text, 62, i === 1 ? 17 : 14.5));
  });
  return items.length;
}

const partyRows = (p: DocParty, hasBuyer: boolean) => p.details.length + 2 + (hasBuyer ? 2 : 0);

const fieldValue = (fields: DocField[], name: string) => fields.find((f) => f.label === name)?.value ?? '';

/** Excel does not allow these characters in a sheet name, and caps it at 31 characters. */
const sheetName = (name: string) => name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Invoice';

/** Builds the invoice workbook: one A4-ready sheet per document, laid out like the PDF. A BOTH invoice gets a "Party" and a "Custom" sheet. */
export async function renderInvoiceExcel(input: InvoiceDocument | InvoiceDocument[]): Promise<Buffer> {
  const docs = Array.isArray(input) ? input : [input];
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Invoice Manager';
  wb.title = `Invoice ${docs[0]!.invoiceNumber}`;
  wb.created = new Date();
  docs.forEach((doc, index) => addInvoiceSheet(wb, doc, docs.length > 1 ? sheetName(`${doc.kindLabel === 'CUSTOM' ? 'Custom' : 'Party'} ${doc.invoiceNumber}`) : 'Invoice', index));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function addInvoiceSheet(wb: ExcelJS.Workbook, doc: InvoiceDocument, name: string, _index: number) {
  const ws = wb.addWorksheet(name, {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.6, header: 0.3, footer: 0.3 } },
    headerFooter: { oddFooter: `&L&8Invoice ${doc.invoiceNumber.replace(/&/g, '&&')}&R&8Page &P of &N` },
    views: [{ showGridLines: false }],
  });
  ws.columns = [5, 16, 26, 16, 11, 15, 13, 16, 18].map((width) => ({ width }));
  const cur = doc.currency;
  const money = `"${cur}" #,##0.00`;
  // the same format in the table: the unit stays next to its number
  const moneyAligned = `"${cur}" #,##0.00`;

  // ---- header band: logo and name on the left, invoice number and date on the right
  [24, 42, 24].forEach((h, i) => { ws.getRow(i + 1).height = h; fillRow(ws, i + 1, 1, 9, PRIMARY); });
  try {
    const logo = wb.addImage({ base64: LOGO_PNG_BASE64, extension: 'png' });
    ws.addImage(logo, { tl: { col: 0.2, row: 0.15 }, ext: { width: 96, height: 94 } });
  } catch {
    // a missing logo must never stop the workbook
  }
  ws.mergeCells('C1:E2');
  const nameCell = ws.getCell('C1');
  nameCell.value = doc.exporter.name.toUpperCase();
  nameCell.font = { bold: true, italic: true, size: 24, color: { argb: WHITE } };
  nameCell.alignment = { vertical: 'bottom', horizontal: 'left', indent: 1 };
  put(ws, 3, 3, 5, TAGLINE, { font: { italic: true, size: 10, name: 'Times New Roman', color: { argb: SOFT_WHITE } }, align: { vertical: 'top' } });
  put(ws, 1, 6, 9, doc.kindLabel ? `INVOICE · ${doc.kindLabel}` : 'INVOICE', { font: { bold: true, size: 12, color: { argb: SOFT_WHITE } }, align: { horizontal: 'right', vertical: 'bottom' } });
  put(ws, 2, 6, 9, doc.invoiceNumber, { font: { bold: true, size: 26, color: { argb: WHITE } }, align: { horizontal: 'right' } });
  put(ws, 3, 6, 9, doc.invoiceDate, { font: { size: 12, color: { argb: SOFT_WHITE } }, align: { horizontal: 'right', vertical: 'top' } });
  ws.mergeCells('A4:I4');
  fillRow(ws, 4, 1, 9, ACCENT);
  ws.getRow(4).height = 5;
  ws.getRow(5).height = 8;

  // ---- exporter | importer
  let row = 6;
  const shared = Math.max(partyRows(doc.exporter, false), partyRows(doc.importer, doc.buyer !== ''));
  const left = partyBlock(ws, row, 1, 4, 'From · Exporter', doc.exporter, null, shared);
  const right = partyBlock(ws, row, 6, 9, 'To · Importer / consignee', doc.importer, doc.buyer, shared);
  row += Math.max(left, right);
  ws.getRow(row++).height = 8;

  // ---- shipment details: 4 columns of label over value
  const ship = (l: string) => fieldValue(doc.shipping, l);
  const goods = (l: string) => fieldValue(doc.goods, l);
  const ref = (l: string) => fieldValue(doc.references, l);
  const grid: [string, string][][] = [
    [['Pre-carriage by', ship('Pre-Carriage by')], ['Place of receipt', ship('Place of Receipt by Pre-Carrier')], ["Exporter's ref.", ref("Exporter's Ref.")], ['AWB no.', ref('AWB No.')]],
    [['Vessel / flight no.', ship('Vessel / Flight No.')], ['Port of loading', ship('Port of Loading')], ["Buyer's order no. & date", ref("Buyer's Order No. & Date")], ['Other reference(s)', ref('Other Reference(s)')]],
    [['Port of discharge', ship('Port of Discharge')], ['Final destination', ship('Final Destination')], ['Country of origin', ship('Country of Origin')], ['Country of destination', ship('Country of Destination')]],
    [['Description of goods', goods('Description of Goods')], ['HS code', goods('HS Code')], ['Terms of delivery', goods('Terms of Delivery')], ['Terms of payment', goods('Terms of Payment')]],
  ];
  const groups: [number, number, number][] = [[1, 2, 21], [3, 3, 32], [4, 6, 36], [7, 9, 40]];
  fillRow(ws, row, 1, 9, TINT);
  ws.getRow(row++).height = 6;
  grid.forEach((cells) => {
    fillRow(ws, row, 1, 9, TINT);
    fillRow(ws, row + 1, 1, 9, TINT);
    cells.forEach(([text, value], i) => {
      const [from, to, chars] = groups[i]!;
      put(ws, row, from, to, text.toUpperCase(), { font: label(), align: { vertical: 'bottom' } });
      put(ws, row + 1, from, to, value, { font: { bold: true, size: 10.5, color: { argb: INK } }, align: { vertical: 'top', wrapText: true } });
      ws.getRow(row + 1).height = Math.max(ws.getRow(row + 1).height ?? 0, heightFor(value, chars, 16));
    });
    ws.getRow(row).height = 15;
    row += 2;
  });
  fillRow(ws, row, 1, 9, TINT);
  ws.getRow(row++).height = 6;
  ws.getRow(row++).height = 8;

  // ---- product table
  const headers = ['#', 'Marks & nos · container', 'Description of goods', 'Nett wt / pkg', 'Boxes', 'Total nett wt', 'Rate / kg', 'Total / box', 'Amount'];
  headers.forEach((text, i) => {
    const cell = ws.getRow(row).getCell(i + 1);
    cell.value = text.toUpperCase();
    cell.font = { bold: true, size: 8, color: { argb: i === 8 ? ON_ACCENT : WHITE } };
    cell.fill = solid(i === 8 ? ACCENT : PRIMARY);
    cell.alignment = { vertical: 'middle', horizontal: i < 3 ? 'left' : 'right', wrapText: true };
  });
  ws.getRow(row).height = 28;
  const tableHeaderRow = row;
  row++;
  const rowPad = doc.lines.length <= 12 ? 21 : doc.lines.length <= 24 ? 18 : 15;
  doc.lines.forEach((line, i) => {
    const r = ws.getRow(row);
    const values: (string | number)[] = [line.no, line.marks, line.description, line.nettPerPackage, line.boxes, line.totalNett, line.rate, line.totalPerBox, line.amount];
    values.forEach((value, c) => {
      const cell = r.getCell(c + 1);
      cell.value = value;
      cell.border = { bottom: GRID_LINE };
      cell.alignment = { vertical: 'middle', horizontal: c < 3 ? 'left' : 'right', wrapText: c === 1 || c === 2 };
      cell.font = { size: c === 0 ? 9 : 10, color: { argb: c === 0 ? FAINT : c === 1 ? MUTED : INK }, bold: c === 8 };
      if (i % 2 === 1) cell.fill = solid(TINT);
      if (c === 3) cell.numFmt = `"KGS" ${NUMBER_2}`;
      if (c === 4) cell.numFmt = '#,##0';
      if (c === 5) cell.numFmt = Number.isInteger(line.totalNett) ? '#,##0' : NUMBER_2;
      if (c === 6) cell.numFmt = NUMBER_2;
      if (c === 7 || c === 8) cell.numFmt = moneyAligned;
    });
    r.height = Math.max(heightFor(line.marks, 12, 14), heightFor(line.description, 34, 14), rowPad);
    row++;
  });
  // a frame round the whole table
  for (let r = tableHeaderRow; r < row; r++) {
    const a = ws.getRow(r).getCell(1);
    const z = ws.getRow(r).getCell(9);
    a.border = { ...a.border, left: FRAME_LINE, ...(r === tableHeaderRow ? { top: FRAME_LINE } : {}), ...(r === row - 1 ? { bottom: FRAME_LINE } : {}) };
    z.border = { ...z.border, right: FRAME_LINE, ...(r === tableHeaderRow ? { top: FRAME_LINE } : {}), ...(r === row - 1 ? { bottom: FRAME_LINE } : {}) };
    if (r === tableHeaderRow || r === row - 1) for (let c = 2; c <= 8; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.border = { ...cell.border, ...(r === tableHeaderRow ? { top: FRAME_LINE } : { bottom: FRAME_LINE }) };
    }
  }
  ws.getRow(row++).height = 8;

  // ---- weights and amount in words (left), sub total / round off / total (right)
  const top = row;
  const roundOff = Math.round((doc.totals.total - doc.totals.subTotal) * 100) / 100;
  const wordsText = doc.amountInWords ? `(${cur}) ${doc.amountInWords}` : '';
  // rows: 0 weight labels, 1 weight values, 2 gap, 3 words label, 4 words text
  for (let i = 0; i < 5; i++) fillRow(ws, top + i, 1, 4, i === 2 ? WHITE : TINT);
  for (let i = 0; i < 5; i++) fillRow(ws, top + i, 6, 9, TINT);
  const weightGroups: [number, number][] = [[1, 2], [3, 3], [4, 4]];
  const weights: [string, number | null, string][] = [['No. of packages', doc.totals.packages, '#,##0'], ['Total nett weight', doc.totals.nettWeight, `${NUMBER_2} "KGS"`], ['Total gross weight', doc.totals.grossWeight, `${NUMBER_2} "KGS"`]];
  weights.forEach(([text, value, fmt], i) => {
    const [from, to] = weightGroups[i]!;
    put(ws, top, from, to, text.toUpperCase(), { font: label(7), align: { vertical: 'bottom', wrapText: true } });
    put(ws, top + 1, from, to, value, { font: { bold: true, size: 11, color: { argb: INK } }, align: { horizontal: 'left' }, numFmt: fmt });
  });
  ws.getRow(top).height = 24;
  ws.getRow(top + 1).height = 20;
  ws.getRow(top + 2).height = 6;
  put(ws, top + 3, 1, 4, 'AMOUNT IN WORDS', { font: label(8), align: { vertical: 'bottom' } });
  put(ws, top + 3 + 1, 1, 4, wordsText, { font: { bold: true, size: 11, color: { argb: INK } }, align: { vertical: 'top', wrapText: true } });
  ws.getRow(top + 3).height = 18;
  ws.getRow(top + 4).height = Math.max(heightFor(wordsText, 56, 16), 34);

  const figure = (r: number, text: string, value: number | null, fmt: string, font: Partial<ExcelJS.Font>) => {
    put(ws, r, 6, 7, text, { font: { size: 10.5, color: { argb: MUTED }, ...font } });
    put(ws, r, 8, 9, value, { font: { size: 10.5, color: { argb: INK }, ...font }, align: { horizontal: 'right' }, numFmt: fmt });
  };
  figure(top, 'Sub total', doc.totals.subTotal, NUMBER_2, {});
  figure(top + 1, 'Round off', roundOff === 0 ? null : roundOff, NUMBER_2, {});
  // the Total sits in the accent colour on the last row of the box
  fillRow(ws, top + 4, 6, 9, ACCENT);
  put(ws, top + 4, 6, 7, 'Total', { font: { bold: true, size: 13, color: { argb: ON_ACCENT } } });
  put(ws, top + 4, 8, 9, doc.totals.total, { font: { bold: true, size: 13, color: { argb: ON_ACCENT } }, align: { horizontal: 'right', indent: 1 }, numFmt: money });
  row = top + 5;
  ws.getRow(row++).height = 8;

  // ---- bank details and declaration (left), seal and sign (right)
  const bankTop = row;
  const bank = (l: string) => fieldValue(doc.bank, l);
  for (let i = 0; i < 5; i++) fillRow(ws, bankTop + i, 1, 4, TINT);
  put(ws, bankTop, 1, 4, 'BANK DETAILS', { font: label(8), align: { vertical: 'bottom' } });
  const bankCells: [string, string][][] = [[['Bank name', bank('Bank Name')], ['Account number', bank('Account Number')]], [['IFSC code', bank('IFSC Code')], ['SWIFT code', bank('SWIFT Code')]]];
  bankCells.forEach((pair, i) => {
    pair.forEach(([text, value], c) => {
      const [from, to] = c === 0 ? [1, 2] : [3, 4];
      put(ws, bankTop + 1 + i * 2, from, to, text.toUpperCase(), { font: label(7), align: { vertical: 'bottom' } });
      put(ws, bankTop + 2 + i * 2, from, to, value, { font: { bold: true, size: 11, color: { argb: INK } }, align: { vertical: 'top' } });
    });
  });
  [18, 13, 18, 13, 18].forEach((h, i) => { ws.getRow(bankTop + i).height = h; });
  ws.getRow(bankTop + 5).height = 14; // gap, and the line above the signature label sits on the row below
  const declTop = bankTop + 6;
  for (let i = 0; i < 2; i++) fillRow(ws, declTop + i, 1, 4, TINT);
  put(ws, declTop, 1, 4, 'DECLARATION', { font: label(8), align: { vertical: 'bottom' } });
  put(ws, declTop + 1, 1, 4, doc.declaration, { font: { size: 10, color: { argb: MUTED } }, align: { vertical: 'top', wrapText: true } });
  ws.getRow(declTop).height = 18;
  ws.getRow(declTop + 1).height = Math.max(heightFor(doc.declaration, 62, 14), 30);

  // seal and sign: the image sits in the free space on the right, the line and caption under it
  if (doc.sign) {
    try {
      const id = wb.addImage({ buffer: doc.sign.bytes as unknown as ExcelJS.Buffer, extension: doc.sign.mime === 'image/png' ? 'png' : 'jpeg' });
      ws.addImage(id, { tl: { col: 5.9, row: bankTop + 1.1 }, ext: { width: 150, height: 56 } });
    } catch {
      // a damaged image must not stop the workbook
    }
  }
  const signRow = declTop;
  put(ws, signRow, 6, 9, 'Seal & Sign', { font: { size: 9, color: { argb: MUTED } }, align: { horizontal: 'center', vertical: 'top' } });
  for (let c = 6; c <= 9; c++) ws.getRow(signRow).getCell(c).border = { top: { style: 'thin', color: { argb: INK } } };
  row = declTop + 2;

  ws.pageSetup.printArea = `A1:${LAST_COL}${row}`;
  ws.pageSetup.printTitlesRow = `${tableHeaderRow}:${tableHeaderRow}`;
}

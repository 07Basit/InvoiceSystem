import ExcelJS from 'exceljs';
import type { DocField, DocParty, InvoiceDocument } from './invoice-document';

const TEAL = 'FF082C2C';
const TEAL_SOFT = 'FFE6F2F2';
const ORANGE = 'FFFF6600';
const ROW_ALT = 'FFF7FAFA';
const MUTED = 'FF6B7580';
const BORDER = { style: 'thin', color: { argb: 'FFB4C2C4' } } as const;
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER } as const;
const ORANGE_EDGE = { style: 'thick', color: { argb: ORANGE } } as const;

/** Picks which edges get a line (the left edge can be the orange accent). */
function edges(spec: { top?: boolean; bottom?: boolean; left?: boolean | 'accent'; right?: boolean }): Partial<ExcelJS.Borders> {
  const out: Partial<ExcelJS.Borders> = {};
  if (spec.top) out.top = BORDER;
  if (spec.bottom) out.bottom = BORDER;
  if (spec.left) out.left = spec.left === 'accent' ? ORANGE_EDGE : BORDER;
  if (spec.right) out.right = BORDER;
  return out;
}
const LAST_COL = 'I';
const NUMBER_2 = '#,##0.00';

/** Rough row height for wrapped text in a merged range `chars` characters wide. */
function heightFor(text: string, chars: number, line = 15): number {
  const lines = text.split(/\r?\n/).reduce((n, part) => n + Math.max(1, Math.ceil(part.length / chars)), 0);
  return Math.max(line, lines * line);
}

function band(ws: ExcelJS.Worksheet, row: number, title: string) {
  ws.mergeCells(`A${row}:${LAST_COL}${row}`);
  const cell = ws.getCell(`A${row}`);
  cell.value = title.toUpperCase();
  cell.font = { bold: true, size: 10, color: { argb: TEAL } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_SOFT } };
  cell.alignment = { vertical: 'middle', indent: 1 };
  for (let c = 1; c <= 9; c++) ws.getRow(row).getCell(c).border = edges({ top: true, bottom: true, right: c === 9, left: c === 1 ? 'accent' : false });
  ws.getRow(row).height = 20;
}

/** A label cell and a value cell, each merged across `labelSpan` / `valueSpan` columns starting at `startCol` (1-based). Every cell is boxed. */
function pair(ws: ExcelJS.Worksheet, row: number, startCol: number, labelSpan: number, valueSpan: number, field: DocField) {
  const first = ws.getColumn(startCol).letter;
  const labelEnd = ws.getColumn(startCol + labelSpan - 1).letter;
  const valueStart = ws.getColumn(startCol + labelSpan).letter;
  const valueEnd = ws.getColumn(startCol + labelSpan + valueSpan - 1).letter;
  if (labelSpan > 1) ws.mergeCells(`${first}${row}:${labelEnd}${row}`);
  if (valueSpan > 1) ws.mergeCells(`${valueStart}${row}:${valueEnd}${row}`);
  for (let c = startCol; c < startCol + labelSpan + valueSpan; c++) {
    const cell = ws.getRow(row).getCell(c);
    cell.border = ALL_BORDERS;
    if (c < startCol + labelSpan) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROW_ALT } };
  }
  const label = ws.getCell(`${first}${row}`);
  label.value = field.label;
  label.font = { size: 9, color: { argb: MUTED } };
  label.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
  const value = ws.getCell(`${valueStart}${row}`);
  value.value = field.value;
  value.font = { bold: true, size: 10 };
  value.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
}

/** Label/value pairs, two per row; each row is tall enough for its longest value. */
function pairs(ws: ExcelJS.Worksheet, startRow: number, fields: DocField[]): number {
  let row = startRow;
  for (let i = 0; i < fields.length; i += 2) {
    const left = fields[i]!;
    const right = fields[i + 1];
    pair(ws, row, 1, 2, 3, left);
    if (right) pair(ws, row, 6, 2, 2, right);
    else {
      // keep the grid whole: one empty boxed cell across the free half
      ws.mergeCells(`F${row}:I${row}`);
      for (let c = 6; c <= 9; c++) ws.getRow(row).getCell(c).border = ALL_BORDERS;
    }
    ws.getRow(row).height = Math.max(heightFor(left.value, 34), right ? heightFor(right.value, 24) : 0, 20);
    row++;
  }
  return row;
}

const partyRows = (p: DocParty) => p.details.length + 2;

function partyBlock(ws: ExcelJS.Worksheet, row: number, fromCol: string, toCol: string, title: string, p: DocParty, minRows: number): number {
  const lines = [p.name, ...p.details];
  while (lines.length + 1 < minRows) lines.push('');
  const rows = lines.length + 1;
  const firstIdx = ws.getColumn(fromCol).number;
  const lastIdx = ws.getColumn(toCol).number;

  const writeRow = (r: number, text: string, font: Partial<ExcelJS.Font>, fill?: string) => {
    ws.mergeCells(`${fromCol}${r}:${toCol}${r}`);
    for (let c = firstIdx; c <= lastIdx; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.border = edges({ top: r === row, bottom: r === row + rows - 1, left: c === firstIdx ? 'accent' : false, right: c === lastIdx });
      if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    }
    const cell = ws.getCell(`${fromCol}${r}`);
    cell.value = text;
    cell.font = font;
    cell.alignment = { vertical: 'top', wrapText: true, indent: 1 };
    ws.getRow(r).height = Math.max(ws.getRow(r).height ?? 0, heightFor(text, 40), 18);
  };

  writeRow(row, title.toUpperCase(), { bold: true, size: 8, color: { argb: MUTED } }, TEAL_SOFT);
  lines.forEach((text, i) => writeRow(row + 1 + i, text, i === 0 ? { bold: true, size: 12 } : { size: 10 }));
  return rows;
}

/** Builds the invoice workbook: one A4-ready sheet laid out in the same sections as the PDF. */
export async function renderInvoiceExcel(doc: InvoiceDocument): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Invoice Manager';
  wb.title = `Invoice ${doc.invoiceNumber}`;
  wb.created = new Date();

  const ws = wb.addWorksheet('Invoice', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } },
    headerFooter: { oddFooter: `&L&8Invoice ${doc.invoiceNumber.replace(/&/g, '&&')}&R&8Page &P of &N` },
    views: [{ showGridLines: false }],
  });
  ws.columns = [6, 18, 30, 13, 11, 14, 12, 14, 16].map((width) => ({ width }));

  // title block
  ws.mergeCells('A1:E1');
  ws.mergeCells('F1:I1');
  ws.mergeCells('A2:E2');
  ws.mergeCells('F2:I2');
  ws.getCell('A1').value = 'INVOICE';
  ws.getCell('A2').value = 'COMMERCIAL INVOICE';
  ws.getCell('F1').value = `No. ${doc.invoiceNumber}`;
  ws.getCell('F2').value = `Date ${doc.invoiceDate}   |   Currency ${doc.currency}`;
  for (const ref of ['A1', 'A2', 'F1', 'F2']) {
    const cell = ws.getCell(ref);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
    cell.alignment = { vertical: 'middle', indent: 1, horizontal: ref.startsWith('F') ? 'right' : 'left' };
  }
  ws.getCell('A1').font = { bold: true, size: 22, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A2').font = { size: 9, color: { argb: 'FFB3D9D9' } };
  ws.getCell('F1').font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  ws.getCell('F2').font = { size: 10, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).height = 34;
  ws.getRow(2).height = 20;
  ws.mergeCells('A3:I3');
  ws.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
  ws.getRow(3).height = 4;

  // exporter | importer
  const top = 5;
  const shared = Math.max(partyRows(doc.exporter), partyRows(doc.importer));
  const left = partyBlock(ws, top, 'A', 'D', 'Exporter', doc.exporter, shared);
  const right = partyBlock(ws, top, 'F', 'I', 'Importer / Consignee', doc.importer, shared);
  let row = top + Math.max(left, right) + 1;

  ws.mergeCells(`A${row}:I${row}`);
  const buyer = ws.getCell(`A${row}`);
  buyer.value = { richText: [{ text: 'Buyer (if other than consignee):  ', font: { size: 9, color: { argb: MUTED } } }, { text: doc.buyer, font: { bold: true, size: 10 } }] };
  for (let c = 1; c <= 9; c++) ws.getRow(row).getCell(c).border = ALL_BORDERS;
  buyer.alignment = { indent: 1, vertical: 'middle' };
  ws.getRow(row).height = 22;
  row += 2;

  band(ws, row++, 'Invoice references');
  row = pairs(ws, row, doc.references) + 1;
  band(ws, row++, 'Shipping and route');
  row = pairs(ws, row, doc.shipping) + 1;
  band(ws, row++, 'Goods and terms');
  const [description, ...terms] = doc.goods;
  pair(ws, row, 1, 2, 7, description!);
  ws.getRow(row).height = Math.max(heightFor(description!.value, 90), 20);
  row = pairs(ws, row + 1, terms) + 1;

  // product table
  band(ws, row++, 'Product details');
  const headers = ['No', 'Marks & Container No.', 'Description of Goods', 'Nett Wt Per Package', 'No of Boxes', 'Total Nett Wt (KGS)', 'Rate Per KG', 'Total Per Box', `Amount (${doc.currency})`];
  headers.forEach((text, i) => {
    const cell = ws.getRow(row).getCell(i + 1);
    cell.value = text;
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
    cell.alignment = { vertical: 'middle', horizontal: i < 3 ? 'left' : 'right', wrapText: true };
    cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  });
  ws.getRow(row).height = 30;
  const tableHeaderRow = row;
  row++;
  doc.lines.forEach((line, i) => {
    const r = ws.getRow(row);
    const values: (string | number)[] = [line.no, line.marks, line.description, line.nettPerPackage, line.boxes, line.totalNett, line.rate, line.totalPerBox, line.amount];
    values.forEach((value, c) => {
      const cell = r.getCell(c + 1);
      cell.value = value;
      cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
      cell.alignment = { vertical: 'top', horizontal: c < 3 ? 'left' : 'right', wrapText: c === 1 || c === 2 };
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROW_ALT } };
      if (c >= 3 && c !== 4) cell.numFmt = NUMBER_2;
      if (c === 4) cell.numFmt = '#,##0';
      if (c === 8) cell.font = { bold: true };
    });
    r.height = Math.max(heightFor(line.marks, 18), heightFor(line.description, 32), 20);
    row++;
  });
  row++;

  // totals: amount in words on the left, figures on the right
  const totalsTop = row;
  const figures: [string, number | string, string?][] = [
    ['No. of Packages', doc.totals.packages, '#,##0'],
    ['Total Nett Weight (KGS)', doc.totals.nettWeight, NUMBER_2],
    ...(doc.totals.grossWeight !== null ? ([['Total Gross Weight (KGS)', doc.totals.grossWeight, NUMBER_2]] as [string, number, string][]) : []),
    [`Sub Total (${doc.currency})`, doc.totals.subTotal, NUMBER_2],
  ];
  figures.forEach(([label, value, fmt], i) => {
    const r = totalsTop + i;
    ws.mergeCells(`F${r}:H${r}`);
    const l = ws.getCell(`F${r}`);
    l.value = label;
    l.font = { size: 10, color: { argb: MUTED } };
    l.alignment = { horizontal: 'right' };
    const v = ws.getCell(`I${r}`);
    v.value = value;
    if (fmt) v.numFmt = fmt;
    v.font = { bold: true, size: 10 };
    for (let c = 6; c <= 9; c++) ws.getRow(r).getCell(c).border = ALL_BORDERS;
  });
  const totalRow = totalsTop + figures.length;
  ws.mergeCells(`F${totalRow}:H${totalRow}`);
  const tl = ws.getCell(`F${totalRow}`);
  tl.value = `TOTAL (${doc.currency})`;
  tl.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  tl.alignment = { horizontal: 'right', vertical: 'middle' };
  tl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  const tv = ws.getCell(`I${totalRow}`);
  tv.value = doc.totals.total;
  tv.numFmt = NUMBER_2;
  tv.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  tv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  for (let c = 6; c <= 9; c++) ws.getRow(totalRow).getCell(c).border = ALL_BORDERS;
  ws.getRow(totalRow).height = 24;

  ws.mergeCells(`A${totalsTop}:D${totalRow}`);
  const words = ws.getCell(`A${totalsTop}`);
  words.value = { richText: [{ text: 'AMOUNT IN WORDS\n', font: { bold: true, size: 8, color: { argb: MUTED } } }, { text: doc.amountInWords ? `${doc.currency} ${doc.amountInWords}` : '', font: { bold: true, size: 10 } }] };
  words.alignment = { vertical: 'top', wrapText: true, indent: 1 };
  for (let r = totalsTop; r <= totalRow; r++) for (let c = 1; c <= 4; c++) ws.getRow(r).getCell(c).border = ALL_BORDERS;
  words.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROW_ALT } };
  row = totalRow + 2;

  band(ws, row++, 'Bank details');
  row = pairs(ws, row, doc.bank) + 1;

  band(ws, row++, 'Declaration');
  ws.mergeCells(`A${row}:I${row}`);
  const declaration = ws.getCell(`A${row}`);
  declaration.value = doc.declaration;
  declaration.alignment = { vertical: 'top', wrapText: true, indent: 1 };
  declaration.font = { size: 10 };
  for (let c = 1; c <= 9; c++) ws.getRow(row).getCell(c).border = ALL_BORDERS;
  ws.getRow(row).height = heightFor(doc.declaration, 105);
  row += 2;

  // seal & sign
  ws.mergeCells(`F${row}:I${row}`);
  const forCell = ws.getCell(`F${row}`);
  forCell.value = `For ${doc.exporter.name}`;
  forCell.font = { bold: true, size: 10 };
  forCell.alignment = { horizontal: 'right' };
  row++;
  const signRows = 4;
  for (let i = 0; i < signRows; i++) ws.getRow(row + i).height = 18;
  if (doc.sign) {
    try {
      const id = wb.addImage({ buffer: doc.sign.bytes as unknown as ExcelJS.Buffer, extension: doc.sign.mime === 'image/png' ? 'png' : 'jpeg' });
      ws.addImage(id, { tl: { col: 6.4, row: row - 0.1 }, ext: { width: 170, height: 66 } });
    } catch {
      // a damaged image must not stop the workbook
    }
  }
  row += signRows;
  ws.mergeCells(`F${row}:I${row}`);
  const signLabel = ws.getCell(`F${row}`);
  signLabel.value = 'Authorised Signatory';
  signLabel.font = { size: 9, color: { argb: MUTED } };
  signLabel.alignment = { horizontal: 'right' };
  signLabel.border = { top: { style: 'thin', color: { argb: MUTED } } };

  ws.pageSetup.printArea = `A1:${LAST_COL}${row}`;
  ws.pageSetup.printTitlesRow = `${tableHeaderRow}:${tableHeaderRow}`;

  return Buffer.from(await wb.xlsx.writeBuffer());
}

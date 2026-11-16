import ExcelJS from 'exceljs';
import type { PaymentStatus, Statement, StatementSection } from 'shared';
import { formatDate } from './invoice-document';

const PRIMARY = 'FF1F5A3B';
const TINT = 'FFEEF6F0';
const TINT_STRONG = 'FFD4E5D9';
const INK = 'FF14291C';
const MUTED = 'FF46594D';
const RED = 'FFB42318';
const GREEN = 'FF1A7F4B';
const WHITE = 'FFFFFFFF';
const NUMBER = '#,##0.00';
const STATUS_LABEL: Record<PaymentStatus, string> = { unpaid: 'Unpaid', partial: 'Part paid', paid: 'Paid', overpaid: 'Overpaid' };

const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const day = (iso: string) => formatDate(new Date(`${iso}T00:00:00.000Z`));
const sheetName = (currency: string) => `Statement ${currency}`.slice(0, 31);

/** A statement of account as a workbook: one sheet per currency, with the ledger and where each invoice stands. */
export async function renderStatementExcel(statement: Statement): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = 'Invoice Manager';
  const period = statement.from || statement.to ? `${statement.from ? day(statement.from) : 'Start'} to ${statement.to ? day(statement.to) : 'today'}` : 'All dates';

  const sections = statement.sections.length ? statement.sections : [null];
  for (const section of sections) {
    const sheet = book.addWorksheet(section ? sheetName(section.currency) : 'Statement', { views: [{ showGridLines: false }] });
    sheet.columns = [{ width: 14 }, { width: 24 }, { width: 44 }, { width: 16 }, { width: 16 }, { width: 16 }];
    header(sheet, statement, period);
    if (section) body(sheet, section);
    else sheet.getCell('A8').value = 'There are no actual invoices or payments for this importer in this period.';
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

function header(sheet: ExcelJS.Worksheet, statement: Statement, period: string) {
  sheet.mergeCells('A1:F1');
  const title = sheet.getCell('A1');
  title.value = 'STATEMENT OF ACCOUNT';
  title.font = { bold: true, size: 16, color: { argb: WHITE } };
  title.fill = solid(PRIMARY);
  title.alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(1).height = 32;
  const info: [string, string][] = [['Importer', statement.importer.name], ['Period', period], ['Prepared', day(statement.generatedOn)]];
  if (statement.importer.address) info.splice(1, 0, ['Address', statement.importer.address.replace(/\s*\r?\n\s*/g, ', ')]);
  info.forEach(([label, value], i) => {
    const r = 3 + i;
    sheet.getCell(`A${r}`).value = label;
    sheet.getCell(`A${r}`).font = { bold: true, color: { argb: MUTED } };
    sheet.mergeCells(`B${r}:F${r}`);
    sheet.getCell(`B${r}`).value = value;
  });
}

function body(sheet: ExcelJS.Worksheet, section: StatementSection) {
  let r = 8;
  sheet.mergeCells(`A${r}:F${r}`);
  const heading = sheet.getCell(`A${r}`);
  heading.value = `Account in ${section.currency}`;
  heading.font = { bold: true, size: 12, color: { argb: WHITE } };
  heading.fill = solid(PRIMARY);
  heading.alignment = { indent: 1 };
  r += 2;

  const figures: [string, number, string][] = [['Balance brought forward', section.opening, INK], ['Invoiced', section.invoiced, INK], ['Received', section.received, GREEN], ['Balance due', section.closing, section.closing > 0.005 ? RED : GREEN]];
  for (const [label, value, color] of figures) {
    sheet.mergeCells(`A${r}:C${r}`);
    sheet.getCell(`A${r}`).value = label;
    sheet.getCell(`A${r}`).font = { bold: true, color: { argb: MUTED } };
    const cell = sheet.getCell(`D${r}`);
    cell.value = value;
    cell.numFmt = NUMBER;
    cell.font = { bold: true, color: { argb: color } };
    r += 1;
  }
  r += 1;

  const head = (labels: string[]) => {
    labels.forEach((label, i) => {
      const cell = sheet.getCell(r, i + 1);
      cell.value = label;
      cell.font = { bold: true, size: 9, color: { argb: MUTED } };
      cell.fill = solid(TINT_STRONG);
      cell.alignment = { horizontal: i >= 3 ? 'right' : 'left' };
    });
    r += 1;
  };
  head(['Date', 'Invoice', 'Details', 'Invoiced', 'Received', 'Balance']);
  if (section.opening !== 0) {
    sheet.getCell(`C${r}`).value = 'Balance brought forward';
    sheet.getCell(`F${r}`).value = section.opening;
    sheet.getCell(`F${r}`).numFmt = NUMBER;
    sheet.getRow(r).font = { bold: true };
    r += 1;
  }
  section.rows.forEach((row, i) => {
    sheet.getCell(`A${r}`).value = day(row.date);
    sheet.getCell(`B${r}`).value = row.reference;
    sheet.getCell(`C${r}`).value = row.description;
    if (row.debit) { sheet.getCell(`D${r}`).value = row.debit; sheet.getCell(`D${r}`).numFmt = NUMBER; }
    if (row.credit) { sheet.getCell(`E${r}`).value = row.credit; sheet.getCell(`E${r}`).numFmt = NUMBER; sheet.getCell(`E${r}`).font = { color: { argb: GREEN } }; }
    sheet.getCell(`F${r}`).value = row.balance;
    sheet.getCell(`F${r}`).numFmt = NUMBER;
    sheet.getCell(`F${r}`).font = { bold: true };
    if (i % 2 === 1) for (let c = 1; c <= 6; c++) sheet.getCell(r, c).fill = solid(TINT);
    r += 1;
  });
  sheet.getCell(`C${r}`).value = 'Balance due';
  sheet.getCell(`D${r}`).value = section.invoiced;
  sheet.getCell(`E${r}`).value = section.received;
  sheet.getCell(`F${r}`).value = section.closing;
  for (const col of ['D', 'E', 'F']) sheet.getCell(`${col}${r}`).numFmt = NUMBER;
  for (let c = 1; c <= 6; c++) { sheet.getCell(r, c).font = { bold: true }; sheet.getCell(r, c).border = { top: { style: 'thin', color: { argb: PRIMARY } } }; }
  r += 3;

  if (section.invoices.length > 0) {
    sheet.getCell(`A${r}`).value = 'INVOICES';
    sheet.getCell(`A${r}`).font = { bold: true, size: 9, color: { argb: MUTED } };
    r += 1;
    head(['Invoice', 'Date', 'Status', 'Total', 'Paid', 'Balance']);
    section.invoices.forEach((inv, i) => {
      sheet.getCell(`A${r}`).value = inv.number;
      sheet.getCell(`B${r}`).value = day(inv.date);
      sheet.getCell(`C${r}`).value = STATUS_LABEL[inv.status];
      sheet.getCell(`C${r}`).font = { bold: true, color: { argb: inv.status === 'paid' ? GREEN : inv.status === 'unpaid' ? RED : INK } };
      for (const [col, value] of [['D', inv.total], ['E', inv.paid], ['F', inv.balance]] as const) { sheet.getCell(`${col}${r}`).value = value; sheet.getCell(`${col}${r}`).numFmt = NUMBER; }
      sheet.getCell(`F${r}`).font = { bold: true, color: { argb: inv.balance > 0.005 ? RED : INK } };
      if (i % 2 === 1) for (let c = 1; c <= 6; c++) sheet.getCell(r, c).fill = solid(TINT);
      r += 1;
    });
  }
}

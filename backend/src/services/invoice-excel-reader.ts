import * as XLSX from 'xlsx';
import { AppError } from '../utils/AppError';
import { INFO_SHEET, LINE_ID_HEADER } from './invoice-excel';
import { parseNumber } from './purchase-import';

/** One row of the product table, as typed in the file. Numbers that are missing or unreadable are null. */
export interface ExcelRow {
  /** The row in the sheet (1-based) */
  row: number;
  /** The id written in the hidden column, if the row still has one */
  id: string | null;
  marks: string;
  description: string;
  nettPerPackage: number | null;
  boxes: number | null;
  rate: number | null;
  /** The amount as typed (the app works it out itself; this is only to point out a difference) */
  amount: number | null;
}

export interface ExcelMeta {
  invoiceId: string;
  /** For a Party + Custom invoice, the later of its two pages' versions */
  version: string;
  both: boolean;
  /** The hidden Custom page's invoice, for a Party + Custom invoice */
  companionId: string | null;
}

export interface ExcelPage {
  sheet: string;
  rows: ExcelRow[];
}

export interface ExcelRead {
  meta: ExcelMeta | null;
  /** Every sheet that has a product table, in order: a Party + Custom invoice has a Party and a Custom sheet */
  pages: ExcelPage[];
  /** The first page (what a single-page invoice is) */
  sheet: string;
  rows: ExcelRow[];
}

const LOOKS_LIKE_EXCEL = (b: Buffer) => (b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0);

const norm = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const textOf = (cell: XLSX.CellObject | undefined) => (cell && cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : '');
const numberOf = (cell: XLSX.CellObject | undefined): number | null => {
  if (!cell || cell.v === undefined || cell.v === null || cell.v === '') return null;
  return typeof cell.v === 'number' ? cell.v : parseNumber(String(cell.v));
};

interface Columns { marks?: number; description: number; nett?: number; boxes: number; rate?: number; amount?: number; id?: number }

/** The columns of the product table, found by their titles. The title row is the one that says "Description of goods" and "Boxes". */
function findHeader(sheet: XLSX.WorkSheet, range: XLSX.Range): { row: number; columns: Columns } | null {
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 200); r++) {
    const found: Partial<Columns> = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
      const raw = textOf(sheet[XLSX.utils.encode_cell({ r, c })]);
      if (!raw) continue;
      if (raw === LINE_ID_HEADER) { found.id = c; continue; }
      const t = norm(raw);
      if (/^description/.test(t)) found.description = c;
      else if (/^marks/.test(t)) found.marks = c;
      else if (/^(nett?|net) (wt|weight)? ?(per|pkg)|per (pkg|package)/.test(t) || /^nett? wt pkg$/.test(t)) found.nett = c;
      else if (t === 'boxes' || /^(no of )?boxes$|^packages?$/.test(t)) found.boxes = c;
      else if (/^rate/.test(t)) found.rate = c;
      else if (t === 'amount') found.amount = c;
    }
    if (found.description !== undefined && found.boxes !== undefined) return { row: r, columns: found as Columns };
  }
  return null;
}

/**
 * Reads the product table of an invoice Excel that was downloaded from the app and edited. Which invoice the file came from
 * is read from the hidden info sheet; each row's id from the hidden column. Both may be missing in a file that was rebuilt by hand.
 */
export function readInvoiceExcel(buffer: Buffer): ExcelRead {
  if (!LOOKS_LIKE_EXCEL(buffer)) throw new AppError('That is not an Excel file. Choose the invoice you downloaded as .xlsx.', 400, 'EXCEL_BAD_FILE');
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  } catch {
    throw new AppError('That Excel file could not be read.', 400, 'EXCEL_BAD_FILE');
  }

  let meta: ExcelMeta | null = null;
  const info = book.Sheets[INFO_SHEET];
  if (info) {
    const rows = new Map<string, string>();
    for (let r = 0; r < 20; r++) rows.set(textOf(info[XLSX.utils.encode_cell({ r, c: 0 })]), textOf(info[XLSX.utils.encode_cell({ r, c: 1 })]));
    if (rows.get('app') === 'invoice-manager' && rows.get('invoiceId')) meta = { invoiceId: rows.get('invoiceId')!, version: rows.get('version') ?? '', both: rows.get('both') === 'yes', companionId: rows.get('companionId') || null };
  }

  // every sheet (but the hidden one) that has a product table
  const pages: ExcelPage[] = [];
  for (const name of book.SheetNames.filter((n) => n !== INFO_SHEET)) {
    const sheet = book.Sheets[name];
    if (!sheet?.['!ref']) continue;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const header = findHeader(sheet, range);
    if (!header) continue;
    const { columns } = header;
    const rows: ExcelRow[] = [];
    for (let r = header.row + 1; r <= Math.min(range.e.r, header.row + 600); r++) {
      const at = (c: number | undefined) => (c === undefined ? undefined : sheet[XLSX.utils.encode_cell({ r, c })]);
      // below the table come the weights ("No. of packages", ...): the table ends there
      let ended = false;
      for (let c = range.s.c; c <= range.e.c; c++) if (/^no\.? ?of packages$/i.test(textOf(sheet[XLSX.utils.encode_cell({ r, c })]))) ended = true;
      if (ended) break;
      const row: ExcelRow = {
        row: r + 1,
        id: textOf(at(columns.id)) || null,
        marks: textOf(at(columns.marks)),
        description: textOf(at(columns.description)),
        nettPerPackage: numberOf(at(columns.nett)),
        boxes: numberOf(at(columns.boxes)),
        rate: numberOf(at(columns.rate)),
        amount: numberOf(at(columns.amount)),
      };
      // empty rows (and the numbering column on its own) are not lines
      if (!row.description && !row.marks && row.nettPerPackage === null && row.boxes === null && row.rate === null) continue;
      rows.push(row);
    }
    pages.push({ sheet: name, rows });
  }
  if (pages.length > 0) return { meta, pages, sheet: pages[0]!.sheet, rows: pages[0]!.rows };
  throw new AppError('The table of product lines was not found in that file. Use the Excel downloaded from the invoice, and keep its column titles.', 400, 'EXCEL_NO_TABLE');
}

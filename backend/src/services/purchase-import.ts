import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { AppError } from '../utils/AppError';
import type { ParsedPurchase, ParsedPurchaseLine, PurchaseColumn, PurchaseHeaderField, PurchaseTemplate } from 'shared';

/**
 * Reads a purchase invoice from an Excel file (.xlsx or .xls) into the fields of a purchase invoice.
 *
 * Nothing has to be configured: the invoice details are found next to their labels ("Invoice No.", "Date", "Freight" ...) and
 * the item table by the titles of its columns ("Particulars", "Qty", "Net Wt", "Rate", "Amount" ...). A supplier whose file does
 * not fit can have a template that names the sheet, cells, labels or column titles to use instead.
 * What was read is only a suggestion: it is shown on a review screen and corrected there before anything is saved.
 */

interface Cell {
  r: number;
  c: number;
  text: string;
  num: number | null;
  /** ISO date when the cell is a date */
  date: string | null;
}
type Grid = (Cell | null)[][];

const MAX_ROWS = 2000;

// ---------------------------------------------------------------- reading values

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const validDate = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "10.10.26", "26/10/2026", "2026-10-26", "10 Oct 2026", "Oct 10, 2026" -> "2026-10-10" (day first when it is a day/month pair). */
export function parseDateText(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, ' ');
  const year = (v: string) => (v.length === 2 ? 2000 + Number(v) : Number(v));
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (m && validDate(Number(m[1]), Number(m[2]), Number(m[3]))) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})\b/.exec(text);
  if (m && validDate(year(m[3]!), Number(m[2]), Number(m[1]))) return iso(year(m[3]!), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})[-/. ]([a-z]{3,9})[-/. ,]*(\d{2}|\d{4})\b/i.exec(text);
  if (m) {
    const month = MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()) + 1;
    if (month && validDate(year(m[3]!), month, Number(m[1]))) return iso(year(m[3]!), month, Number(m[1]));
  }
  m = /^([a-z]{3,9})[-/. ]+(\d{1,2})(?:st|nd|rd|th)?[-/. ,]+(\d{2}|\d{4})\b/i.exec(text);
  if (m) {
    const month = MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase()) + 1;
    if (month && validDate(year(m[3]!), month, Number(m[2]))) return iso(year(m[3]!), month, Number(m[2]));
  }
  return null;
}

/** "1,23,456.50", "₹ 1,200/-", "(500.00)", "45 kg" -> number; null when there is no number. */
export function parseNumber(raw: string): number | null {
  const text = raw.trim();
  if (!/\d/.test(text)) return null;
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text);
  const cleaned = text.replace(/[₹$€£]|rs\.?|inr|\/-|kgs?\b|kilos?\b|nos\.?|pcs\.?|%/gi, '').replace(/[(),\s]/g, '').replace(/^-/, '');
  if (!/^\d*\.?\d+$/.test(cleaned) && !/^\d+\.?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

const isDateFormat = (format: string | number | undefined) => {
  if (typeof format === 'number') return (format >= 14 && format <= 22) || (format >= 45 && format <= 47); // Excel's built-in date and time formats
  if (!format) return false;
  const bare = format.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
  return /[dy]/i.test(bare) && !/[0#]/.test(bare);
};

function cellOf(sheet: XLSX.WorkSheet, r: number, c: number): Cell | null {
  const raw = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
  if (!raw || raw.v === undefined || raw.v === null || raw.v === '') return null;
  if (raw.t === 'n' && typeof raw.v === 'number') {
    if (isDateFormat(raw.z)) {
      const d = XLSX.SSF.parse_date_code(raw.v);
      if (d) return { r, c, text: raw.w ?? iso(d.y, d.m, d.d), num: null, date: iso(d.y, d.m, d.d) };
    }
    return { r, c, text: raw.w ?? String(raw.v), num: raw.v, date: null };
  }
  const text = String(raw.v).trim();
  if (!text) return null;
  return { r, c, text, num: parseNumber(text), date: parseDateText(text) };
}

function toGrid(sheet: XLSX.WorkSheet): Grid {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
  const grid: Grid = [];
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + MAX_ROWS - 1); r++) {
    const row: (Cell | null)[] = [];
    for (let c = 0; c <= range.e.c; c++) row.push(cellOf(sheet, r, c));
    grid[r] = row;
  }
  for (let r = 0; r < grid.length; r++) grid[r] ??= [];
  return grid;
}

const address = (cell: Cell) => XLSX.utils.encode_cell({ r: cell.r, c: cell.c });
const norm = (text: string) => text.toLowerCase().replace(/[\s_]+/g, ' ').replace(/[:*]+$/g, '').trim();
const numberOf = (cell: Cell | null) => (cell ? cell.num ?? parseNumber(cell.text) : null);

const letterToColumn = (letters: string) => letters.toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// ---------------------------------------------------------------- finding the item table

const COLUMN_PATTERNS: [PurchaseColumn, RegExp][] = [
  // the weight of one box or bag ("N.WT / BOX"), not the weight of the whole line
  ['packWeight', /\b(n\.?\s*wt|net\s*w(ei)?g?h?t|nett?|weight|wt)\b.*(\/|\bper\b|\beach\b)\s*(box|bag|bags|pkg|pack|carton|ctn|crate|unit|pc|piece)/],
  // what the packing of the line costs ("BOX TOTAL")
  ['packing', /box\s*total|bag\s*total|packing|packaging|pkg\s*(charges?|total)/],
  ['rate', /\b(rate|price)\b/],
  ['netWeight', /(net\s*w(ei)?g?h?t|nett|\bt\.?\s*net\b|total\s*net|net\s*total|total\s*(weight|kgs?)|\bweight\b|\bwt\b|(qty|quantity)\s*\(?\s*(in\s*)?kgs?\)?|^\s*kgs?\s*$|\bkgs\b)/],
  ['amount', /\b(amount|value|total)\b/],
  // the kind of package ("CTN / Bags": box, bag, crate ...), which is text, not a count
  ['unit', /^(unit|uom|units)$|ctn\s*\/\s*bags?|package\s*type|pack(ing)?\s*type/],
  ['quantity', /(^|\b)(qty|quantity|nos?\.?|boxes|box|packages?|packs?|bags?|pcs|pieces|cartons?|crates?)(\b|$)/],
  ['description', /\b(description|particulars?|items?|products?|goods|commodity|variety|material)\b/],
];

function classifyHeader(text: string): PurchaseColumn | null {
  const t = norm(text);
  if (!t || t.length > 60 || /^\d+$/.test(t)) return null;
  if (/\bhsn\b|\bsac\b|\bs\.?\s*no\b|^sr\b|^sl\b|^#$|^no\.?$/.test(t)) return null;
  for (const [column, pattern] of COLUMN_PATTERNS) if (pattern.test(t)) return column;
  return null;
}

interface Table {
  headerRow: number;
  columns: Partial<Record<PurchaseColumn, number>>;
  /** Every column titled like an amount ("Total" twice: goods, then goods with packing); the one that fits rate x weight is used */
  amountColumns: number[];
}

function findTable(grid: Grid, template: PurchaseTemplate | null | undefined): Table | null {
  const named = template?.columns;
  const byTemplate = (row: (Cell | null)[]): Partial<Record<PurchaseColumn, number>> => {
    const columns: Partial<Record<PurchaseColumn, number>> = {};
    for (const [column, title] of Object.entries(named ?? {}) as [PurchaseColumn, string][]) {
      if (/^[A-Za-z]{1,3}$/.test(title)) { columns[column] = letterToColumn(title); continue; }
      const want = norm(title);
      const hit = row.find((cell) => cell && norm(cell.text).includes(want));
      if (hit) columns[column] = hit.c;
    }
    return columns;
  };

  const rows = template?.headerRow ? [template.headerRow - 1] : grid.map((_, r) => r).slice(0, 80);
  for (const r of rows) {
    const row = grid[r];
    if (!row) continue;
    const columns: Partial<Record<PurchaseColumn, number>> = {};
    const amountColumns: number[] = [];
    for (const cell of row) {
      if (!cell || cell.num !== null && /^\d/.test(cell.text) && !/[a-z]/i.test(cell.text)) continue;
      const column = classifyHeader(cell.text);
      if (!column) continue;
      if (column === 'amount') amountColumns.push(cell.c);
      // the first column of a kind wins, except amount (a "Total" at the far right is the line amount)
      if (columns[column] === undefined || column === 'amount') columns[column] = cell.c;
    }
    Object.assign(columns, byTemplate(row));
    if (named?.amount && columns.amount !== undefined) amountColumns.splice(0, amountColumns.length, columns.amount);
    const found = Object.keys(columns).length;
    const usable = columns.description !== undefined && (columns.amount !== undefined || columns.rate !== undefined);
    if (usable && (found >= 3 || template?.headerRow)) return { headerRow: r, columns, amountColumns };
  }
  return null;
}

/** A row of freight, GST or other charges under the products is not a product. */
const isChargeRow = (label: string) => [FIELD_LABELS.freight, FIELD_LABELS.otherCharges, FIELD_LABELS.taxAmount, FIELD_LABELS.subTotal].some((pattern) => pattern.test(label));

const END_OF_ITEMS = /^(sub\s*-?\s*total|total|grand\s*total|amount\s*in\s*words|rupees|in\s*words|terms|notes?|bank|declaration|remarks?|authori[sz]ed|signature|for\s)/i;

const closeTo = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.01);

/** Which of several "Total" columns is the amount of the line: the one that equals rate x weight (or quantity) on most rows. */
function pickAmountColumn(grid: Grid, table: Table): number | undefined {
  const { columns, amountColumns } = table;
  if (amountColumns.length < 2 || columns.rate === undefined) return columns.amount;
  const score = new Map<number, number>(amountColumns.map((c) => [c, 0]));
  for (let r = table.headerRow + 1; r < Math.min(grid.length, table.headerRow + 80); r++) {
    const row = grid[r] ?? [];
    const rate = numberOf(row[columns.rate] ?? null);
    const weight = columns.netWeight !== undefined ? numberOf(row[columns.netWeight] ?? null) : null;
    const quantity = columns.quantity !== undefined ? numberOf(row[columns.quantity] ?? null) : null;
    if (rate === null || (!weight && !quantity)) continue;
    for (const c of amountColumns) {
      const value = numberOf(row[c] ?? null);
      if (value !== null && ((weight && closeTo(rate * weight, value)) || (quantity && closeTo(rate * quantity, value)))) score.set(c, (score.get(c) ?? 0) + 1);
    }
  }
  const best = Math.max(...score.values());
  return best > 0 ? [...amountColumns].reverse().find((c) => score.get(c) === best) : columns.amount;
}

function readLines(grid: Grid, table: Table, template: PurchaseTemplate | null | undefined, warnings: string[]): { lines: ParsedPurchaseLine[]; endRow: number; packingTotal: number } {
  const { columns } = table;
  const amountColumn = pickAmountColumn(grid, table);
  let packingTotal = 0;
  const lines: ParsedPurchaseLine[] = [];
  const stop = template?.stopAt ? norm(template.stopAt) : null;
  let blanks = 0;
  let r = table.headerRow + 1;
  for (; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const first = row.find((cell) => cell && cell.text);
    if (!first) { blanks += 1; if (blanks >= 3 && lines.length > 0) break; continue; }
    blanks = 0;
    const label = norm(first.text);
    if ((stop && label.startsWith(stop)) || END_OF_ITEMS.test(label) || isChargeRow(label)) break;

    const description = columns.description !== undefined ? row[columns.description]?.text ?? '' : '';
    const quantity = columns.quantity !== undefined ? numberOf(row[columns.quantity] ?? null) : null;
    let netWeight = columns.netWeight !== undefined ? numberOf(row[columns.netWeight] ?? null) : null;
    // no total weight column: the weight of one box times the number of boxes
    const packWeight = columns.packWeight !== undefined ? numberOf(row[columns.packWeight] ?? null) : null;
    if (netWeight === null && packWeight !== null && quantity !== null) netWeight = Math.round(packWeight * quantity * 1000) / 1000;
    let rate = columns.rate !== undefined ? numberOf(row[columns.rate] ?? null) : null;
    let amount = amountColumn !== undefined ? numberOf(row[amountColumn] ?? null) : null;
    if (!description.trim() || (amount === null && rate === null)) continue; // a heading or a stray row
    if (END_OF_ITEMS.test(norm(description)) || isChargeRow(norm(description))) break;

    // what the rate is per: the kilo (when rate x weight gives the amount) or the unit
    const close = closeTo;
    let basis: 'KG' | 'UNIT' = 'KG';
    if (rate !== null && amount !== null && netWeight && close(rate * netWeight, amount)) basis = 'KG';
    else if (rate !== null && amount !== null && quantity && close(rate * quantity, amount)) basis = 'UNIT';
    else if (!netWeight && quantity) basis = 'UNIT';
    const base = basis === 'KG' ? netWeight : quantity;
    if (amount === null && rate !== null && base) amount = Math.round(rate * base * 100) / 100;
    if (rate === null && amount !== null && base) rate = Math.round((amount / base) * 10000) / 10000;
    if (amount === null || rate === null) { warnings.push(`Row ${r + 1} ("${description.trim()}") has no usable rate or amount.`); continue; }

    if (columns.packing !== undefined) packingTotal += numberOf(row[columns.packing] ?? null) ?? 0;
    lines.push({
      productName: description.trim().replace(/\s+/g, ' ').slice(0, 200),
      ...(quantity !== null ? { quantity } : {}),
      ...(netWeight !== null ? { netWeight } : {}),
      ...(columns.unit !== undefined && row[columns.unit] ? { unit: row[columns.unit]!.text.slice(0, 20) } : {}),
      rate,
      rateBasis: basis,
      amount,
    });
  }
  return { lines, endRow: r, packingTotal: Math.round(packingTotal * 100) / 100 };
}

// ---------------------------------------------------------------- invoice details

const FIELD_LABELS: Record<PurchaseHeaderField, RegExp> = {
  invoiceNumber: /^(tax\s+)?(invoice|inv|bill)\s*(no|number|num|#)\b|^(invoice|bill)\s*#/,
  invoiceDate: /^(tax\s+)?(invoice|inv|bill)\s*date\b|^date\b/,
  purchaseDate: /^(purchase|shipment|dispatch|delivery|order)\s*date\b|^date\s+of\s+(purchase|shipment|dispatch|delivery)\b/,
  dueDate: /^(payment\s+)?due\s*date\b|^payment\s+due\b|^due\s+on\b/,
  subTotal: /^(sub\s*-?\s*total|total\s+before\s+(gst|tax)|taxable\s+(value|amount)|goods\s+value|basic\s+(amount|value))\b/,
  taxAmount: /^(total\s+)?(gst|igst|cgst|sgst|utgst|tax|vat)\b(?!\s*(in|no|number))/,
  freight: /\b(freight|transport(ation)?|carriage|cartage|lorry|delivery\s+charges?)\b/,
  otherCharges: /\b(other\s+(charges?|expenses?)|misc(ellaneous)?|packing|packaging|loading|unloading|handling|labou?r|commission|cold\s*(item|storage|charges?|room))\b/,
  total: /^(grand\s+total|invoice\s+(total|value|amount)|net\s+(payable|amount\s+payable)|total\s+(invoice\s+)?(amount|payable|value)|amount\s+payable|bill\s+amount|total)\b/,
};

type Located = { cell: Cell; value: Cell } | null;

/** A cell whose text matches `label`, with the value written after it ("Invoice No: 123"), to its right, or just under it. */
function locate(grid: Grid, label: RegExp, rows: [number, number], wantNumber: boolean): Located {
  for (let r = rows[0]; r <= Math.min(rows[1], grid.length - 1); r++) {
    const row = grid[r] ?? [];
    for (const cell of row) {
      if (!cell || cell.num !== null && !/[a-z]/i.test(cell.text)) continue;
      const text = norm(cell.text);
      if (text.length > 80) continue;
      const colon = text.search(/[:：]/);
      const labelPart = colon >= 0 ? text.slice(0, colon).trim() : text;
      if (!label.test(labelPart)) continue;
      // "Invoice No: INV-12"
      if (colon >= 0) {
        const after = cell.text.slice(cell.text.search(/[:：]/) + 1).trim();
        if (after) return { cell, value: { r, c: cell.c, text: after, num: parseNumber(after), date: parseDateText(after) } };
      }
      // to the right in the same row, then just below
      const right = row.slice(cell.c + 1, cell.c + 8).filter((x): x is Cell => !!x && x.text !== ':' && x.text !== '-');
      const pick = wantNumber ? right.find((x) => numberOf(x) !== null) : right[0];
      if (pick) return { cell, value: pick };
      const below = grid[r + 1]?.[cell.c];
      if (below && (!wantNumber || numberOf(below) !== null)) return { cell, value: below };
    }
  }
  return null;
}

/** Every labelled amount in the rows (label on the left, the last number of the row on the right), for charges that may repeat. */
function amountsLabelled(grid: Grid, label: RegExp, from: number, exclude?: RegExp): { cell: Cell; amount: number }[] {
  const out: { cell: Cell; amount: number }[] = [];
  for (let r = from; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const cells = row.filter((x): x is Cell => !!x);
    const labelCell = cells.find((x) => (x.num === null || /[a-z]/i.test(x.text)) && label.test(norm(x.text)) && !(exclude && exclude.test(norm(x.text))) && norm(x.text).length < 70);
    if (!labelCell) continue;
    const numbers = cells.filter((x) => x.c > labelCell.c && numberOf(x) !== null);
    const value = numbers[numbers.length - 1];
    if (value) out.push({ cell: labelCell, amount: numberOf(value)! });
  }
  return out;
}

// ---------------------------------------------------------------- recognising a supplier by name

const NAME_NOISE = new Set(['the', 'and', 'mohd', 'mohammed', 'traders', 'trading', 'agro', 'enterprises', 'enterprise', 'exports', 'impex', 'pvt', 'ltd', 'company', 'co']);

/** The words of a name as they sound: "Mehfooz" and "Mahfuz" end up close ("oo" and "u", "ee" and "i" are the same). */
const nameWords = (name: string) => name.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/oo/g, 'u').replace(/ee/g, 'i').split(/\s+/).filter((w) => w.length >= 3 && !NAME_NOISE.has(w));

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length]!;
}

/** Is the saved supplier the one named in the file? A word of one name matches a word of the other, give or take one letter. */
function sameName(saved: string, written: string): boolean {
  const theirs = nameWords(written);
  return nameWords(saved).some((w) => theirs.some((t) => t === w || (Math.min(t.length, w.length) >= 5 && editDistance(t, w) <= 1)));
}

// ---------------------------------------------------------------- the whole file

export interface ParseOptions {
  fileName: string;
  /** The supplier's own template, when there is one */
  template?: PurchaseTemplate | null | undefined;
  /** Saved suppliers, to recognise which one the invoice is from */
  suppliers?: { id: string; name: string }[];
  supplierId?: string | null | undefined;
}

/** .xlsx files are zip archives; the older .xls files start with the OLE signature. (The reader would take any text as a sheet.) */
const looksLikeExcel = (b: Buffer) => (b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0);

export function parsePurchaseWorkbook(buffer: Buffer, options: ParseOptions): ParsedPurchase {
  if (!looksLikeExcel(buffer)) throw new AppError('That is not an Excel file. Upload the invoice as .xlsx or .xls.', 400, 'PURCHASE_BAD_FILE');
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellNF: true, cellDates: false });
  } catch {
    throw new AppError('That Excel file could not be read. Is it a .xlsx or .xls invoice?', 400, 'PURCHASE_BAD_FILE');
  }
  const template = options.template ?? null;
  const sheetName = (template?.sheet && workbook.SheetNames.find((n) => n.toLowerCase() === template.sheet!.toLowerCase()))
    || workbook.SheetNames.map((name) => ({ name, size: Object.keys(workbook.Sheets[name] ?? {}).length })).sort((a, b) => b.size - a.size)[0]?.name;
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheetName || !sheet) throw new AppError('That Excel file has no sheet with data', 400, 'PURCHASE_BAD_FILE');

  const grid = toGrid(sheet);
  const warnings: string[] = [];
  const found: Record<string, string> = {};
  const table = findTable(grid, template);
  if (!table) warnings.push('The table of products was not found. Add the products by hand, or set up this supplier\'s template.');
  const top: [number, number] = [0, table ? table.headerRow : grid.length - 1];
  const bottom: [number, number] = [table ? table.headerRow + 1 : 0, grid.length - 1];

  const fixedCell = (field: PurchaseHeaderField): Cell | null => {
    const ref = template?.fields?.[field]?.cell;
    if (!ref) return null;
    const { r, c } = XLSX.utils.decode_cell(ref);
    return grid[r]?.[c] ?? null;
  };
  const labelFor = (field: PurchaseHeaderField) => {
    const text = template?.fields?.[field]?.label;
    return text ? new RegExp(`^${text.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}`) : FIELD_LABELS[field];
  };

  const headerText = (field: PurchaseHeaderField) => {
    const fixed = fixedCell(field);
    if (fixed) { found[field] = address(fixed); return fixed; }
    const hit = locate(grid, labelFor(field), top, false) ?? locate(grid, labelFor(field), [0, grid.length - 1], false);
    if (hit) found[field] = address(hit.value);
    return hit?.value ?? null;
  };

  const numberCell = headerText('invoiceNumber');
  const invoiceNumber = numberCell?.text.replace(/^[:#\s.-]+/, '').trim() ?? '';
  let invoiceDate = headerText('invoiceDate')?.date ?? null;
  const purchaseDate = headerText('purchaseDate')?.date ?? null;
  const dueDate = headerText('dueDate')?.date ?? null;
  // a date with no label at all: take the one beside the invoice number, or else the first date above the table
  if (!invoiceDate && !template?.fields?.invoiceDate) {
    const dates = grid.slice(top[0], Math.min(top[1], 30) + 1).flat().filter((c): c is Cell => !!c && c.date !== null && c.date !== purchaseDate && c.date !== dueDate);
    const beside = numberCell ? dates.find((c) => c.r === numberCell.r) : undefined;
    const pick = beside ?? dates[0];
    if (pick) { invoiceDate = pick.date; found.invoiceDate = address(pick); }
  }

  // ---- amounts: a fixed cell, or a label with an amount beside it
  const amountOf = (field: PurchaseHeaderField, exclude?: RegExp): number | null => {
    const fixed = fixedCell(field);
    if (fixed) { found[field] = address(fixed); return numberOf(fixed); }
    const label = labelFor(field);
    const all = amountsLabelled(grid, label, bottom[0], exclude);
    if (all.length === 0) {
      const hit = locate(grid, label, [0, grid.length - 1], true);
      if (hit) { found[field] = address(hit.value); return numberOf(hit.value); }
      return null;
    }
    const picked = field === 'total' ? all[all.length - 1]! : all[0]!;
    found[field] = address(picked.cell);
    return picked.amount;
  };

  const { lines, endRow, packingTotal } = table ? readLines(grid, table, template, warnings) : { lines: [], endRow: 0, packingTotal: 0 };
  void endRow;

  // GST may be one line, or CGST + SGST (or IGST) lines
  let taxAmount = 0;
  const taxFixed = fixedCell('taxAmount');
  if (taxFixed) { taxAmount = numberOf(taxFixed) ?? 0; found.taxAmount = address(taxFixed); }
  else {
    const taxRows = amountsLabelled(grid, labelFor('taxAmount'), bottom[0], /gstin|gst\s*(no|number)|tax\s*(id|no)/);
    const summary = taxRows.find((t) => /^total\s+(gst|tax)/.test(norm(t.cell.text)));
    taxAmount = summary ? summary.amount : taxRows.reduce((sum, t) => sum + t.amount, 0);
    if (taxRows[0]) found.taxAmount = address((summary ?? taxRows[0]).cell);
  }

  const sumOf = (field: 'freight' | 'otherCharges'): number => {
    const fixed = fixedCell(field);
    if (fixed) { found[field] = address(fixed); return numberOf(fixed) ?? 0; }
    const rows = amountsLabelled(grid, labelFor(field), bottom[0]);
    if (rows[0]) found[field] = address(rows[0].cell);
    return rows.reduce((sum, row) => sum + row.amount, 0);
  };
  const freight = sumOf('freight');
  // the packing of each line (a charge per box) is one of the other charges
  let otherCharges = sumOf('otherCharges') + packingTotal;
  const roundOff = amountsLabelled(grid, /^(round(ing)?\s*off|adjustment)/, bottom[0]);
  for (const row of roundOff) {
    if (row.amount >= 0) otherCharges += row.amount;
    else warnings.push(`Round off of ${row.amount.toFixed(2)} was not counted; check the total.`);
  }

  const linesTotal = Math.round(lines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100;
  let subTotal = amountOf('subTotal');
  if (subTotal === null && lines.length > 0) subTotal = linesTotal;
  let total = amountOf('total', /\b(qty|quantity|weight|wt|kgs?|boxes|packages|words)\b|sub\s*-?\s*total/);
  if (total === null && subTotal !== null) total = Math.round((subTotal + taxAmount + freight + otherCharges) * 100) / 100;

  if (!invoiceNumber) warnings.push('The invoice number was not found.');
  if (!invoiceDate) warnings.push('The invoice date was not found.');
  if (lines.length === 0 && table) warnings.push('No products were found under the table titles.');
  if (subTotal !== null && lines.length > 0 && Math.abs(subTotal - linesTotal) > 1) warnings.push(`The subtotal (${subTotal.toFixed(2)}) differs from the sum of the products (${linesTotal.toFixed(2)}).`);
  if (total !== null && subTotal !== null && Math.abs(total - (subTotal + taxAmount + freight + otherCharges)) > 1) warnings.push('The total differs from subtotal + GST + freight + other charges. Check the charges.');

  // ---- which supplier: given, named in the top of the sheet or the file name, or written beside a "Supplier name" label
  const named = [
    locate(grid, /^(supplier|vendor|seller|party|sold\s*by)(\s*(name|details))?$|^name\s*of\s*(the\s*)?(supplier|vendor)/, top, false)?.value.text,
    locate(grid, /^(company|firm|business|trade)\s*name$/, top, false)?.value.text,
  ].filter((t): t is string => !!t && /[a-z]{2}/i.test(t));
  let supplierId = options.supplierId ?? null;
  if (!supplierId && options.suppliers?.length) {
    const head = `${options.fileName} ${grid.slice(0, 15).flat().map((c) => c?.text ?? '').join(' ')}`.toLowerCase();
    supplierId = options.suppliers.find((s) => new RegExp(`\\b${s.name.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(head))?.id
      ?? options.suppliers.find((s) => named.some((n) => sameName(s.name, n)))?.id ?? null;
  }
  // a name for "Add supplier" when none is saved: the labelled name, else the first line that looks like a name
  const LABELLED = /name|address|mobile|phone|gst|iec|invoice|bill|tax|date|supplier|company|export|description|consign/i;
  const supplierGuess = supplierId ? null : named[0] ?? named[1] ?? grid.slice(0, 6).flat().find((c) => c && /[a-z]{3}/i.test(c.text) && !LABELLED.test(c.text) && c.text.length < 60)?.text ?? null;

  return {
    fileName: options.fileName,
    fileHash: createHash('sha256').update(buffer).digest('hex'),
    sheetName,
    supplierId,
    supplierGuess,
    invoiceNumber,
    invoiceDate,
    purchaseDate,
    dueDate,
    subTotal,
    taxAmount: Math.round(taxAmount * 100) / 100,
    freight: Math.round(freight * 100) / 100,
    otherCharges: Math.round(otherCharges * 100) / 100,
    total,
    lines,
    found,
    warnings,
    duplicates: [],
  };
}

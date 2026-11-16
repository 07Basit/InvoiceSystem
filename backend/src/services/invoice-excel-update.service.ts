import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { amountInWords } from './invoice-document';
import { invoiceService } from './invoice.service';
import { readInvoiceExcel, type ExcelRow } from './invoice-excel-reader';
import type { ExcelLineChange, ExcelPagePreview, ExcelPreviewLine, ExcelRemovedLine, ExcelTotals, ExcelUpdateApplyDto, ExcelUpdatePreview, ExcelUpdateRecord } from 'shared';

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (value: { toString(): string } | null | undefined) => (value === null || value === undefined ? 0 : Number(value));
const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** The six values that make a product line; everything else is worked out from them. */
interface LineInput { marksAndNos?: string | undefined; containerNo?: string | undefined; descriptionOfGoods: string; netWeightPerPackage: number; numberOfBoxes: number; ratePerKg: number }
interface SavedLine { id: string; marksAndNos: string | null; containerNo: string | null; descriptionOfGoods: string; netWeightPerPackage: { toString(): string }; numberOfBoxes: number; ratePerKg: { toString(): string }; amount: { toString(): string } }

/** What the Excel shows in its first column: the marks, then the container when it differs. */
const marksText = (l: { marksAndNos: string | null; containerNo: string | null }) => {
  const marks = (l.marksAndNos ?? '').trim();
  const container = (l.containerNo ?? '').trim();
  return [marks, container && container !== marks ? container : ''].filter(Boolean).join(' / ');
};

/** The text of a new or changed marks cell as marks and container: "A / B" is both, one value is the marks. */
function splitMarks(text: string): { marksAndNos?: string; containerNo?: string } {
  const parts = text.split(/\s+\/\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { marksAndNos: parts[0]! };
  return { marksAndNos: parts[0]!, containerNo: parts.slice(1).join(' / ') };
}

const calc = (l: { netWeightPerPackage: number; numberOfBoxes: number; ratePerKg: number }) => {
  const totalNetWeight = l.netWeightPerPackage * l.numberOfBoxes;
  return { totalNetWeight: round2(totalNetWeight), totalPerBox: round2(l.netWeightPerPackage * l.ratePerKg), amount: round2(totalNetWeight * l.ratePerKg) };
};

const totalsOf = (lines: { netWeightPerPackage: number; numberOfBoxes: number; ratePerKg: number }[], roundOff: number): ExcelTotals => {
  const boxes = lines.reduce((s, l) => s + l.numberOfBoxes, 0);
  const netWeight = lines.reduce((s, l) => s + l.netWeightPerPackage * l.numberOfBoxes, 0);
  const subTotal = lines.reduce((s, l) => s + l.netWeightPerPackage * l.numberOfBoxes * l.ratePerKg, 0);
  return { boxes, netWeight: round2(netWeight), subTotal: round2(subTotal), total: round2(subTotal + roundOff) };
};

const problemsOf = (row: ExcelRow): string[] => {
  const out: string[] = [];
  if (!row.description) out.push('Description of goods is missing');
  if (row.nettPerPackage === null || !(row.nettPerPackage > 0)) out.push('Nett weight per package must be more than 0');
  if (row.boxes === null || !(row.boxes >= 1) || !Number.isInteger(row.boxes)) out.push('Boxes must be a whole number, 1 or more');
  if (row.rate === null || !(row.rate > 0)) out.push('Rate per kg must be more than 0');
  return out;
};

const LABELS: Record<ExcelLineChange['field'], string> = {
  marksAndNos: 'Marks', containerNo: 'Container', descriptionOfGoods: 'Description', netWeightPerPackage: 'Nett wt / pkg', numberOfBoxes: 'Boxes', ratePerKg: 'Rate / kg',
};

type InvoiceForUpdate = Awaited<ReturnType<typeof invoiceService.getById>>;
/** An invoice and, for a Party + Custom invoice, its hidden Custom page (which is an invoice of its own). */
interface Loaded { main: InvoiceForUpdate; companion: InvoiceForUpdate | null }

const savedOf = (invoice: InvoiceForUpdate) => invoice.lineItems as unknown as SavedLine[];

const asInputs = (lines: SavedLine[]): LineInput[] => lines.map((l) => ({
  ...(l.marksAndNos ? { marksAndNos: l.marksAndNos } : {}), ...(l.containerNo ? { containerNo: l.containerNo } : {}),
  descriptionOfGoods: l.descriptionOfGoods, netWeightPerPackage: num(l.netWeightPerPackage), numberOfBoxes: l.numberOfBoxes, ratePerKg: num(l.ratePerKg),
}));

/** The version an Excel file is checked against: the invoice's, or for a Party + Custom invoice the later of its two pages'. */
const versionOf = ({ main, companion }: Loaded) => {
  const a = main.updatedAt.toISOString();
  const b = companion?.updatedAt.toISOString();
  return b && b > a ? b : a;
};

/** What the update changed, counted against the lines as they were. */
function diffCounts(saved: SavedLine[], next: { id?: string | undefined; marksAndNos?: string | undefined; containerNo?: string | undefined; descriptionOfGoods: string; netWeightPerPackage: number; numberOfBoxes: number; ratePerKg: number }[]) {
  const byId = new Map(saved.map((l) => [l.id, l]));
  const ids = new Set(next.map((l) => l.id).filter(Boolean));
  let added = 0;
  let changed = 0;
  for (const line of next) {
    const old = line.id ? byId.get(line.id) : undefined;
    if (!old) { added += 1; continue; }
    if (marksText(old) !== marksText({ marksAndNos: line.marksAndNos ?? null, containerNo: line.containerNo ?? null }) || old.descriptionOfGoods.trim() !== line.descriptionOfGoods.trim()
      || !same(num(old.netWeightPerPackage), line.netWeightPerPackage) || old.numberOfBoxes !== line.numberOfBoxes || !same(num(old.ratePerKg), line.ratePerKg)) changed += 1;
  }
  return { added, changed, removed: saved.filter((l) => !ids.has(l.id)).length };
}

/** What is kept to undo an update: the lines as they were (the Custom page's too, for a Party + Custom invoice). Older records hold just the lines. */
interface Snapshot { lines: LineInput[]; customLines?: LineInput[] }
const snapshotOf = (stored: unknown): Snapshot => (Array.isArray(stored) ? { lines: stored as LineInput[] } : (stored as Snapshot));

/** Compares the rows of one sheet with the saved lines of the invoice it belongs to. */
function comparePage(invoice: InvoiceForUpdate, rows: ExcelRow[], label: string, warnings: string[], blockers: string[]): ExcelPagePreview & { hasProblems: boolean } {
  const saved = savedOf(invoice);
  const byId = new Map(saved.map((l) => [l.id, l]));
  const taken = new Set<string>();
  const where = label ? `${label}, ` : '';

  const lines: ExcelPreviewLine[] = rows.map((row) => {
    // the hidden id first; a row without one (or copied, so the id is already used) is matched by its description
    let match: SavedLine | undefined = row.id && byId.has(row.id) && !taken.has(row.id) ? byId.get(row.id) : undefined;
    if (!match && !(row.id && taken.has(row.id))) match = saved.find((l) => !taken.has(l.id) && l.descriptionOfGoods.trim().toLowerCase() === row.description.trim().toLowerCase());
    if (match) taken.add(match.id);

    const problems = problemsOf(row);
    const kept = match && marksText(match) === row.marks;
    const marks = kept ? { ...(match!.marksAndNos ? { marksAndNos: match!.marksAndNos } : {}), ...(match!.containerNo ? { containerNo: match!.containerNo } : {}) } : splitMarks(row.marks);
    const input = {
      ...(match ? { id: match.id } : {}), ...marks,
      descriptionOfGoods: row.description, netWeightPerPackage: row.nettPerPackage ?? 0, numberOfBoxes: row.boxes ?? 0, ratePerKg: row.rate ?? 0,
    };

    const changes: ExcelLineChange[] = [];
    if (match) {
      const add = (field: ExcelLineChange['field'], before: string, after: string) => { if (before !== after) changes.push({ field, label: LABELS[field], before, after }); };
      if (!kept) add('marksAndNos', marksText(match), row.marks);
      add('descriptionOfGoods', match.descriptionOfGoods.trim(), row.description);
      if (row.nettPerPackage !== null && !same(num(match.netWeightPerPackage), row.nettPerPackage)) changes.push({ field: 'netWeightPerPackage', label: LABELS.netWeightPerPackage, before: String(num(match.netWeightPerPackage)), after: String(row.nettPerPackage) });
      if (row.boxes !== null && match.numberOfBoxes !== row.boxes) changes.push({ field: 'numberOfBoxes', label: LABELS.numberOfBoxes, before: String(match.numberOfBoxes), after: String(row.boxes) });
      if (row.rate !== null && !same(num(match.ratePerKg), row.rate)) changes.push({ field: 'ratePerKg', label: LABELS.ratePerKg, before: String(num(match.ratePerKg)), after: String(row.rate) });
    }
    const figures = problems.length === 0 ? calc(input) : { totalNetWeight: 0, totalPerBox: 0, amount: 0 };
    if (problems.length === 0 && row.amount !== null && Math.abs(row.amount - figures.amount) > 0.01) {
      warnings.push(`${where}row ${row.row}: the amount typed in Excel (${row.amount.toFixed(2)}) is not boxes × weight × rate (${figures.amount.toFixed(2)}). The calculated amount is used.`.replace(/^./, (c) => c.toUpperCase()));
    }
    return { row: row.row, status: match ? (changes.length ? 'changed' : 'unchanged') : 'added', id: match?.id ?? null, input, ...figures, changes, problems } as ExcelPreviewLine;
  });

  const removed: ExcelRemovedLine[] = saved.filter((l) => !taken.has(l.id)).map((l) => ({ id: l.id, descriptionOfGoods: l.descriptionOfGoods, numberOfBoxes: l.numberOfBoxes, amount: num(l.amount) }));
  const counts = {
    added: lines.filter((l) => l.status === 'added').length,
    changed: lines.filter((l) => l.status === 'changed').length,
    unchanged: lines.filter((l) => l.status === 'unchanged').length,
    removed: removed.length,
  };

  const roundOff = num(invoice.roundOff as never);
  const before: ExcelTotals = { boxes: invoice.totalBoxes, netWeight: num(invoice.totalNetWeight as never), subTotal: num(invoice.subTotal as never), total: num(invoice.total as never) };
  const after = totalsOf(lines.filter((l) => l.problems.length === 0).map((l) => l.input), roundOff);

  if (lines.length === 0) blockers.push(`${label ? `The ${label} sheet has` : 'The file has'} no product lines. An invoice needs at least one.`);
  const gross = invoice.totalGrossWeight === null || invoice.totalGrossWeight === undefined ? null : num(invoice.totalGrossWeight as never);
  if (gross !== null && after.netWeight > gross + 1e-9) blockers.push(`${label ? `${label}: the` : 'The'} total nett weight (${after.netWeight.toFixed(2)} KGS) would be more than the total gross weight on the invoice (${gross.toFixed(2)} KGS). Change the gross weight in the app first.`);

  return { lines, removed, totals: { before, after }, counts, hasProblems: lines.some((l) => l.problems.length > 0) };
}

const changesIn = (c: { added: number; removed: number; changed: number }) => c.added + c.removed + c.changed;

export const invoiceExcelUpdateService = {
  /**
   * The invoice, and for a Party + Custom invoice its hidden Custom page. The Custom page cannot be updated on its own:
   * it is updated together with the Party invoice it belongs to.
   */
  async load(invoiceId: string): Promise<Loaded> {
    const main = await invoiceService.getById(invoiceId);
    if (main.isCompanion) throw new AppError('This is the Custom page of an invoice. Update the Party invoice, which updates both pages.', 400, 'EXCEL_UPDATE_NOT_SUPPORTED');
    const link = await prisma.invoice.findFirst({ where: { counterpartOfId: invoiceId, isCompanion: true, deletedAt: null }, select: { id: true } });
    return { main, companion: link ? await invoiceService.getById(link.id) : null };
  },

  /** Reads the edited file and shows what it would change. Nothing is saved. */
  async preview(invoiceId: string, file: { buffer: Buffer; originalname: string }): Promise<ExcelUpdatePreview> {
    const loaded = await this.load(invoiceId);
    const { main, companion } = loaded;
    const read = readInvoiceExcel(file.buffer);
    if (read.meta && read.meta.invoiceId !== invoiceId) throw new AppError('This file was downloaded from a different invoice. Download the Excel of this invoice, edit it, and upload that.', 400, 'EXCEL_WRONG_INVOICE');

    // a Party + Custom invoice needs both sheets, matched to their pages by name ("Party ...", "Custom ...")
    let partyRows = read.rows;
    let customRows: ExcelRow[] | null = null;
    if (companion) {
      const party = read.pages.find((p) => /^party/i.test(p.sheet)) ?? read.pages[0];
      const custom = read.pages.find((p) => /^custom/i.test(p.sheet)) ?? read.pages.find((p) => p !== party);
      if (!party || !custom || party === custom) throw new AppError('This invoice has a Party page and a Custom page, but the file has only one sheet with a product table. Download the Excel again and keep both sheets.', 400, 'EXCEL_MISSING_PAGE');
      partyRows = party.rows;
      customRows = custom.rows;
    }

    const warnings: string[] = [];
    const blockers: string[] = [];
    const partyPage = comparePage(main, partyRows, companion ? 'Party page' : '', warnings, blockers);
    const customPage = companion && customRows ? comparePage(companion, customRows, 'Custom page', warnings, blockers) : null;

    const version = versionOf(loaded);
    const fileIsOlder = Boolean(read.meta?.version) && read.meta!.version !== version;
    if (!read.meta) warnings.unshift('This file does not look like it was downloaded from this invoice, so its rows were matched to the invoice by their description. Check the changes carefully.');
    else if (fileIsOlder) warnings.unshift('This invoice was changed in the app after you downloaded this file. Applying the file replaces the invoice\'s product lines with what is in the file.');

    let payments: ExcelUpdatePreview['payments'] = null;
    if (main.actualOfId) {
      const sum = await prisma.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } });
      const paid = num(sum._sum.amount);
      if (paid > 0) payments = { paid: round2(paid), balanceBefore: round2(partyPage.totals.before.total - paid), balanceAfter: round2(partyPage.totals.after.total - paid) };
    }

    const nothingChanged = changesIn(partyPage.counts) + (customPage ? changesIn(customPage.counts) : 0) === 0;
    const { hasProblems: _p, ...party } = partyPage;
    const custom = customPage ? (({ hasProblems: _c, ...rest }) => rest)(customPage) : null;
    return {
      invoiceId, invoiceNumber: main.invoiceNumber, currency: main.currency, fileName: file.originalname, invoiceVersion: version, fileIsOlder,
      ...party, custom, payments, warnings, blockers,
      canApply: !nothingChanged && blockers.length === 0 && !partyPage.hasProblems && !(customPage?.hasProblems),
    };
  },

  /** Applies a checked update: the lines are replaced (totals and the amount in words follow), and the old lines are kept so it can be undone. */
  async apply(invoiceId: string, dto: ExcelUpdateApplyDto): Promise<ExcelUpdateRecord> {
    const loaded = await this.load(invoiceId);
    const { main, companion } = loaded;
    if (versionOf(loaded) !== dto.invoiceVersion) throw new AppError('The invoice was changed since the file was checked. Upload the file again to check it against the latest invoice.', 409, 'EXCEL_INVOICE_CHANGED');
    if (companion && !dto.customLines) throw new AppError('This invoice has a Custom page too: its lines are needed.', 400, 'EXCEL_CUSTOM_LINES_MISSING');
    if (!companion && dto.customLines) throw new AppError('This invoice has no Custom page.', 400, 'EXCEL_NO_CUSTOM_PAGE');

    const before: Snapshot = { lines: asInputs(savedOf(main)), ...(companion ? { customLines: asInputs(savedOf(companion)) } : {}) };
    const mine = diffCounts(savedOf(main), dto.lines);
    const theirs = companion ? diffCounts(savedOf(companion), dto.customLines!) : { added: 0, removed: 0, changed: 0 };

    const lineItems = dto.lines.map(({ id: _id, ...rest }) => rest);
    const mainUpdated = await invoiceService.updateRow(invoiceId, { lineItems, amountInWords: amountInWords(totalsOf(lineItems, num(main.roundOff as never)).total, main.currency) });
    let latest = mainUpdated.updatedAt.toISOString();
    if (companion) {
      const customItems = dto.customLines!.map(({ id: _id, ...rest }) => rest);
      try {
        const done = await invoiceService.updateRow(companion.id, { lineItems: customItems, amountInWords: amountInWords(totalsOf(customItems, num(companion.roundOff as never)).total, companion.currency) });
        if (done.updatedAt.toISOString() > latest) latest = done.updatedAt.toISOString();
      } catch (error) {
        // the two pages are updated one after the other: if the second fails, put the first back so they stay in step
        await invoiceService.updateRow(invoiceId, { lineItems: before.lines, amountInWords: amountInWords(totalsOf(before.lines, num(main.roundOff as never)).total, main.currency) }).catch(() => undefined);
        throw error;
      }
    }

    const added = mine.added + theirs.added;
    const removed = mine.removed + theirs.removed;
    const changed = mine.changed + theirs.changed;
    const record = await prisma.invoiceExcelUpdate.create({
      data: { invoiceId, fileName: dto.fileName ?? null, before: before as unknown as Prisma.InputJsonValue, afterVersion: latest, added, removed, changed },
    });
    return { id: record.id, fileName: record.fileName, createdAt: record.createdAt.toISOString(), added, removed, changed, canUndo: true };
  },

  /** The latest update made from Excel that has not been undone, and whether it can be undone now (only while nothing else changed the invoice). */
  async latest(invoiceId: string): Promise<ExcelUpdateRecord | null> {
    const loaded = await this.load(invoiceId);
    const record = await prisma.invoiceExcelUpdate.findFirst({ where: { invoiceId, undoneAt: null }, orderBy: { createdAt: 'desc' } });
    if (!record) return null;
    return { id: record.id, fileName: record.fileName, createdAt: record.createdAt.toISOString(), added: record.added, removed: record.removed, changed: record.changed, canUndo: record.afterVersion === versionOf(loaded) };
  },

  async undo(invoiceId: string): Promise<void> {
    const loaded = await this.load(invoiceId);
    const { main, companion } = loaded;
    const record = await prisma.invoiceExcelUpdate.findFirst({ where: { invoiceId, undoneAt: null }, orderBy: { createdAt: 'desc' } });
    if (!record) throw new AppError('There is no Excel update to undo', 404, 'EXCEL_UPDATE_NOT_FOUND');
    if (record.afterVersion !== versionOf(loaded)) throw new AppError('The invoice was changed after that update, so it cannot be undone automatically.', 409, 'EXCEL_UNDO_NOT_POSSIBLE');
    const snapshot = snapshotOf(record.before);
    await invoiceService.updateRow(invoiceId, { lineItems: snapshot.lines, amountInWords: amountInWords(totalsOf(snapshot.lines, num(main.roundOff as never)).total, main.currency) });
    if (companion && snapshot.customLines) {
      await invoiceService.updateRow(companion.id, { lineItems: snapshot.customLines, amountInWords: amountInWords(totalsOf(snapshot.customLines, num(companion.roundOff as never)).total, companion.currency) });
    }
    await prisma.invoiceExcelUpdate.update({ where: { id: record.id }, data: { undoneAt: new Date() } });
  },
};

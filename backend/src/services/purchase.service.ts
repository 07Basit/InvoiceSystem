import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { containsCi } from '../utils/caseInsensitive';
import { purchaseTemplateSchema } from 'shared';
import type {
  PriceSale, DuplicateMatch, LastPurchaseRate, ListPurchasesQuery, PaginationMeta, ParsedPurchase, PriceHistory, PriceHistoryQuery, PriceOverviewItem, PriceOverviewQuery, PurchaseInvoiceDto,
  PurchaseReport, PurchaseReportQuery, PurchaseTemplate, PurchaseTotals,
} from 'shared';
import { currencyService } from './currency.service';
import { logger } from '../utils/logger';
import { parsePurchaseWorkbook } from './purchase-import';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const isoOf = (date: Date) => date.toISOString().slice(0, 10);
const money = (n: number) => Math.round(n * 100) / 100;
const num = (value: { toString(): string } | null | undefined) => (value === null || value === undefined ? 0 : Number(value));
/** "Amla ", "AMLA" and "amla" are the same product. */
export const productKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
/** "MP/26/118", "mp-26-118 " and "MP 26 118" are the same invoice number. */
export const invoiceKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const withLines = {
  lines: { orderBy: { sortOrder: 'asc' } },
  supplier: { select: { id: true, name: true } },
  invoice: { select: { id: true, invoiceNumber: true, invoiceDate: true, currency: true, importerName: true } },
} satisfies Prisma.PurchaseInvoiceInclude;
type PurchaseRow = Prisma.PurchaseInvoiceGetPayload<{ include: typeof withLines }>;

/** A purchase invoice as the API shows it: dates as YYYY-MM-DD and amounts as numbers. */
function present(p: PurchaseRow) {
  return {
    id: p.id,
    supplierId: p.supplierId,
    supplierName: p.supplier.name,
    invoiceNumber: p.invoiceNumber,
    invoiceDate: isoOf(p.invoiceDate),
    purchaseDate: p.purchaseDate ? isoOf(p.purchaseDate) : null,
    dueDate: p.dueDate ? isoOf(p.dueDate) : null,
    currency: p.currency,
    subTotal: num(p.subTotal), taxAmount: num(p.taxAmount), freight: num(p.freight), otherCharges: num(p.otherCharges), total: num(p.total),
    notes: p.notes,
    sourceFileName: p.sourceFileName,
    invoiceId: p.invoiceId,
    invoice: p.invoice ? { id: p.invoice.id, invoiceNumber: p.invoice.invoiceNumber, invoiceDate: isoOf(p.invoice.invoiceDate), currency: p.invoice.currency, importerName: p.invoice.importerName } : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    lines: p.lines.map((l) => ({
      id: l.id, productName: l.productName, description: l.description, quantity: l.quantity === null ? null : num(l.quantity), netWeight: l.netWeight === null ? null : num(l.netWeight),
      unit: l.unit, rate: num(l.rate), rateBasis: l.rateBasis as 'KG' | 'UNIT', amount: num(l.amount),
    })),
  };
}

/** The date a purchase counts on in reports: the purchase date when there is one, otherwise the invoice date. */
const effectiveDate = (p: { purchaseDate: Date | null; invoiceDate: Date }) => isoOf(p.purchaseDate ?? p.invoiceDate);

/** "Baby Karela", "BABY KARELA " and "Baby Karela (500g PP)" are the same product; a name that starts with the other also counts. */
const baseName = (name: string) => productKey(name.replace(/\([^)]*\)/g, ' '));
export const sameProduct = (a: string, b: string) => {
  const x = baseName(a);
  const y = baseName(b);
  return x.length > 0 && y.length > 0 && (x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(`${y} `) || y.startsWith(`${x} `))));
};

/** Rupees for 1 unit of an invoice's currency on its date: a rate typed on the invoice, else the app's exchange rates (through its base currency). */
async function rupeesPerUnit(invoices: { currency: string; invoiceDate: Date; manualRate: unknown; manualRateBase: string | null }[]): Promise<Map<{ currency: string; invoiceDate: Date }, number | null>> {
  const result = new Map<{ currency: string; invoiceDate: Date }, number | null>();
  const pending = invoices.filter((inv) => {
    if (inv.currency === 'INR') { result.set(inv, 1); return false; }
    if (inv.manualRateBase === 'INR' && Number(inv.manualRate) > 0) { result.set(inv, Number(inv.manualRate)); return false; }
    return true;
  });
  if (pending.length === 0) return result;
  try {
    const rupee = (inv: { invoiceDate: Date }) => ({ total: 1, currency: 'INR', invoiceDate: inv.invoiceDate });
    const converter = await currencyService.buildConverter(pending.flatMap((inv) => [{ total: 1, currency: inv.currency, invoiceDate: inv.invoiceDate, manualRate: inv.manualRate, manualRateBase: inv.manualRateBase }, rupee(inv)]));
    for (const inv of pending) {
      const own = converter.convertDetailed({ total: 1, currency: inv.currency, invoiceDate: inv.invoiceDate, manualRate: inv.manualRate, manualRateBase: inv.manualRateBase });
      const inr = converter.convertDetailed(rupee(inv));
      result.set(inv, own && inr && inr.rate > 0 ? own.rate / inr.rate : null);
    }
  } catch (error) {
    logger.warn('Could not get exchange rates for the connected invoices', { error: (error as Error).message });
    for (const inv of pending) result.set(inv, null);
  }
  return result;
}

interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  currency: string;
  fx: number | null;
  lineItems: { descriptionOfGoods: string; ratePerKg: unknown; totalNetWeight: unknown }[];
}

/** The actual invoices purchases are connected to, with the rupee value of one unit of their currency. */
async function loadSaleInvoices(ids: string[]): Promise<Map<string, SaleInvoice>> {
  const out = new Map<string, SaleInvoice>();
  if (ids.length === 0) return out;
  const invoices = await prisma.invoice.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, invoiceNumber: true, currency: true, invoiceDate: true, manualRate: true, manualRateBase: true, lineItems: { select: { descriptionOfGoods: true, ratePerKg: true, totalNetWeight: true } } },
  });
  const rupees = await rupeesPerUnit(invoices);
  for (const inv of invoices) out.set(inv.id, { id: inv.id, invoiceNumber: inv.invoiceNumber, currency: inv.currency, fx: rupees.get(inv) ?? null, lineItems: inv.lineItems });
  return out;
}

/** What an invoice charged per kg for a product (the average, weighted by kilos, when it is on several lines), and the same in rupees. */
function saleOf(inv: SaleInvoice, product: string): PriceSale | null {
  const matching = inv.lineItems.filter((l) => sameProduct(l.descriptionOfGoods, product));
  if (matching.length === 0) return null;
  const kilos = matching.reduce((sum, l) => sum + num(l.totalNetWeight as never), 0);
  const rate = kilos > 0 ? matching.reduce((sum, l) => sum + num(l.ratePerKg as never) * num(l.totalNetWeight as never), 0) / kilos : matching.reduce((sum, l) => sum + num(l.ratePerKg as never), 0) / matching.length;
  const fx = inv.fx;
  return { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, currency: inv.currency, rate: Math.round(rate * 10000) / 10000, rateInr: fx === null ? null : Math.round(rate * fx * 100) / 100, fxRate: fx === null ? null : Math.round(fx * 1e6) / 1e6 };
}

/** For purchases connected to an actual invoice: what that invoice charged per kg for the product. */
async function salesFor(rows: { id: string; invoiceId: string | null }[], product: string): Promise<Map<string, PriceSale>> {
  const out = new Map<string, PriceSale>();
  const invoices = await loadSaleInvoices([...new Set(rows.map((r) => r.invoiceId).filter((id): id is string => !!id))]);
  for (const row of rows) {
    const inv = row.invoiceId ? invoices.get(row.invoiceId) : undefined;
    const sale = inv ? saleOf(inv, product) : null;
    if (sale) out.set(row.id, sale);
  }
  return out;
}

function dateRange(from?: string, to?: string): Prisma.PurchaseInvoiceWhereInput {
  if (!from && !to) return {};
  const range = { ...(from ? { gte: day(from) } : {}), ...(to ? { lte: day(to) } : {}) };
  return { OR: [{ purchaseDate: range }, { purchaseDate: null, invoiceDate: range }] };
}

const emptyTotals = (): PurchaseTotals => ({ count: 0, subTotal: 0, taxAmount: 0, freight: 0, otherCharges: 0, total: 0 });
const addTo = (t: PurchaseTotals, p: { subTotal: number; taxAmount: number; freight: number; otherCharges: number; total: number }) => {
  t.count += 1; t.subTotal += p.subTotal; t.taxAmount += p.taxAmount; t.freight += p.freight; t.otherCharges += p.otherCharges; t.total += p.total;
};
const rounded = (t: PurchaseTotals): PurchaseTotals => ({ count: t.count, subTotal: money(t.subTotal), taxAmount: money(t.taxAmount), freight: money(t.freight), otherCharges: money(t.otherCharges), total: money(t.total) });

export const purchaseService = {
  async list(query: ListPurchasesQuery): Promise<{ data: unknown[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.PurchaseInvoiceWhereInput = {
      deletedAt: null,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.invoiceFrom || query.invoiceTo ? { invoiceDate: { ...(query.invoiceFrom ? { gte: day(query.invoiceFrom) } : {}), ...(query.invoiceTo ? { lte: day(query.invoiceTo) } : {}) } } : {}),
      ...(query.purchaseFrom || query.purchaseTo ? { purchaseDate: { ...(query.purchaseFrom ? { gte: day(query.purchaseFrom) } : {}), ...(query.purchaseTo ? { lte: day(query.purchaseTo) } : {}) } } : {}),
      ...(query.product ? { lines: { some: { productName: containsCi(query.product) } } } : {}),
      ...(query.search ? { OR: [{ invoiceNumber: containsCi(query.search) }, { supplier: { name: containsCi(query.search) } }] } : {}),
    };
    const sort = query.sort ?? 'invoiceDate';
    const order = query.order ?? 'desc';
    const [rows, total] = await prisma.$transaction([
      prisma.purchaseInvoice.findMany({ where, include: withLines, orderBy: [{ [sort]: order }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
      prisma.purchaseInvoice.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return { data: rows.map(present), meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 } };
  },

  async getById(id: string) {
    const row = await prisma.purchaseInvoice.findFirst({ where: { id, deletedAt: null }, include: withLines });
    if (!row) throw new AppError('Purchase invoice not found', 404, 'PURCHASE_NOT_FOUND');
    return present(row);
  },

  /**
   * Invoices that are already saved and look like this one: the same supplier and invoice number (however it is spaced or capitalised),
   * or the very same Excel file. A deleted invoice does not count, so a wrong one can be deleted and entered again.
   */
  async findDuplicates(input: { supplierId?: string | null | undefined; invoiceNumber?: string | undefined; fileHash?: string | undefined; exceptId?: string | undefined }): Promise<DuplicateMatch[]> {
    const or: Prisma.PurchaseInvoiceWhereInput[] = [];
    if (input.supplierId && input.invoiceNumber?.trim()) or.push({ supplierId: input.supplierId });
    if (input.fileHash) or.push({ sourceHash: input.fileHash });
    if (or.length === 0) return [];
    const rows = await prisma.purchaseInvoice.findMany({
      where: { deletedAt: null, ...(input.exceptId ? { NOT: { id: input.exceptId } } : {}), OR: or },
      select: { id: true, invoiceNumber: true, invoiceDate: true, total: true, supplierId: true, sourceHash: true, supplier: { select: { name: true } } },
      orderBy: { invoiceDate: 'desc' },
    });
    const matches: DuplicateMatch[] = [];
    const wanted = input.invoiceNumber ? invoiceKey(input.invoiceNumber) : '';
    for (const row of rows) {
      const sameNumber = Boolean(wanted) && row.supplierId === input.supplierId && invoiceKey(row.invoiceNumber) === wanted;
      const sameFile = Boolean(input.fileHash) && row.sourceHash === input.fileHash;
      if (!sameNumber && !sameFile) continue;
      matches.push({ id: row.id, reason: sameNumber ? 'invoice-number' : 'same-file', invoiceNumber: row.invoiceNumber, supplierName: row.supplier.name, invoiceDate: isoOf(row.invoiceDate), total: num(row.total) });
    }
    return matches;
  },

  async assertSupplier(supplierId: string) {
    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, deletedAt: null }, select: { id: true } });
    if (!supplier) throw new AppError('Supplier not found', 400, 'SUPPLIER_NOT_FOUND');
  },

  /** A purchase can only be connected to an actual invoice that still exists. */
  async assertInvoice(invoiceId?: string) {
    if (!invoiceId) return;
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, deletedAt: null, actualOfId: { not: null } }, select: { id: true } });
    if (!invoice) throw new AppError('Choose one of your actual invoices', 400, 'PURCHASE_INVOICE_NOT_ACTUAL');
  },

  async assertNotDuplicate(dto: PurchaseInvoiceDto, exceptId?: string) {
    const [first] = await this.findDuplicates({ supplierId: dto.supplierId, invoiceNumber: dto.invoiceNumber, fileHash: dto.sourceHash, exceptId });
    if (first) {
      const why = first.reason === 'same-file' ? 'This Excel file was already added' : `Invoice ${first.invoiceNumber} from ${first.supplierName} was already added`;
      throw new AppError(`${why} (invoice date ${first.invoiceDate}).`, 409, 'PURCHASE_DUPLICATE');
    }
  },

  async create(dto: PurchaseInvoiceDto) {
    await this.assertSupplier(dto.supplierId);
    await this.assertInvoice(dto.invoiceId);
    await this.assertNotDuplicate(dto);
    const created = await prisma.purchaseInvoice.create({
      data: { ...invoiceData(dto), lines: { create: linesData(dto) } },
      include: withLines,
    });
    return present(created);
  },

  async update(id: string, dto: PurchaseInvoiceDto) {
    await this.getById(id);
    await this.assertSupplier(dto.supplierId);
    await this.assertInvoice(dto.invoiceId);
    await this.assertNotDuplicate(dto, id);
    const [, updated] = await prisma.$transaction([
      prisma.purchaseLine.deleteMany({ where: { purchaseInvoiceId: id } }),
      prisma.purchaseInvoice.update({ where: { id }, data: { ...invoiceData(dto), lines: { create: linesData(dto) } }, include: withLines }),
    ]);
    return present(updated);
  },

  async remove(id: string) {
    await this.getById(id);
    await prisma.purchaseInvoice.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  // ---------------------------------------------------------------- upload and review

  /** Reads an uploaded Excel invoice for the review screen. Nothing is saved. */
  async preview(file: { buffer: Buffer; originalname: string }, options: { supplierId?: string | undefined; template?: unknown }): Promise<ParsedPurchase> {
    const suppliers = await prisma.supplier.findMany({ where: { deletedAt: null, isActive: true }, select: { id: true, name: true, importTemplate: true } });
    const chosen = options.supplierId ? suppliers.find((s) => s.id === options.supplierId) : undefined;
    if (options.supplierId && !chosen) throw new AppError('Supplier not found', 400, 'SUPPLIER_NOT_FOUND');

    let template: PurchaseTemplate | null = null;
    if (options.template !== undefined && options.template !== null) {
      const parsed = purchaseTemplateSchema.safeParse(options.template);
      if (!parsed.success) throw new AppError('The template is not valid', 400, 'PURCHASE_BAD_TEMPLATE');
      template = parsed.data;
    } else if (chosen?.importTemplate) {
      const parsed = purchaseTemplateSchema.safeParse(chosen.importTemplate);
      template = parsed.success ? parsed.data : null;
    }

    let result = parsePurchaseWorkbook(file.buffer, { fileName: file.originalname, template, suppliers, supplierId: options.supplierId });
    // the supplier was recognised from the file: read it again with that supplier's own template
    if (!options.supplierId && result.supplierId) {
      const found = suppliers.find((s) => s.id === result.supplierId);
      const parsed = found?.importTemplate ? purchaseTemplateSchema.safeParse(found.importTemplate) : null;
      if (parsed?.success) result = parsePurchaseWorkbook(file.buffer, { fileName: file.originalname, template: parsed.data, suppliers, supplierId: result.supplierId });
    }
    result.duplicates = await this.findDuplicates({ supplierId: result.supplierId, invoiceNumber: result.invoiceNumber, fileHash: result.fileHash });
    return result;
  },

  // ---------------------------------------------------------------- reports

  async report(query: PurchaseReportQuery): Promise<PurchaseReport> {
    const rows = await prisma.purchaseInvoice.findMany({
      where: {
        deletedAt: null,
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...dateRange(query.from, query.to),
        ...(query.product ? { lines: { some: { productName: containsCi(query.product) } } } : {}),
      },
      include: withLines,
    });
    const wanted = query.product ? productKey(query.product) : null;
    const totals = emptyTotals();
    const suppliers = new Map<string, PurchaseTotals & { supplierId: string; supplierName: string }>();
    const products = new Map<string, { product: string; lines: number; quantity: number; netWeight: number; amount: number; rates: { rate: number; basis: string }[] }>();

    for (const row of rows) {
      const p = present(row);
      const matching = wanted ? p.lines.filter((l) => productKey(l.productName).includes(wanted)) : p.lines;
      // a product filter counts only what was bought of that product (the charges belong to the whole invoice)
      const figures = wanted
        ? { subTotal: matching.reduce((s, l) => s + l.amount, 0), taxAmount: 0, freight: 0, otherCharges: 0, total: matching.reduce((s, l) => s + l.amount, 0) }
        : p;
      addTo(totals, figures);
      const entry = suppliers.get(p.supplierId) ?? { ...emptyTotals(), supplierId: p.supplierId, supplierName: p.supplierName };
      addTo(entry, figures);
      suppliers.set(p.supplierId, entry);
      for (const l of matching) {
        const key = productKey(l.productName);
        const item = products.get(key) ?? { product: l.productName.trim(), lines: 0, quantity: 0, netWeight: 0, amount: 0, rates: [] };
        item.lines += 1; item.quantity += l.quantity ?? 0; item.netWeight += l.netWeight ?? 0; item.amount += l.amount; item.rates.push({ rate: l.rate, basis: l.rateBasis });
        products.set(key, item);
      }
    }

    return {
      from: query.from ?? null,
      to: query.to ?? null,
      totals: rounded(totals),
      bySupplier: [...suppliers.values()].map((s) => ({ ...rounded(s), supplierId: s.supplierId, supplierName: s.supplierName })).sort((a, b) => a.supplierName.localeCompare(b.supplierName)),
      byProduct: [...products.values()]
        .map((p) => {
          // rates per kilo are compared with each other; a product bought only by the unit uses those
          const kg = p.rates.filter((r) => r.basis === 'KG');
          const rates = (kg.length ? kg : p.rates).map((r) => r.rate);
          return {
            product: p.product, lines: p.lines, quantity: money(p.quantity), netWeight: money(p.netWeight), amount: money(p.amount),
            averageRate: kg.length && p.netWeight > 0 ? Math.round((p.amount / p.netWeight) * 10000) / 10000 : Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 10000) / 10000,
            minRate: Math.min(...rates), maxRate: Math.max(...rates),
          };
        })
        .sort((a, b) => b.amount - a.amount),
    };
  },

  /** The rate a product was bought at on each purchase, oldest first, with how the latest compares with the one before. */
  async priceHistory(query: PriceHistoryQuery): Promise<PriceHistory> {
    const wanted = productKey(query.product);
    const rows = await prisma.purchaseInvoice.findMany({
      where: { deletedAt: null, ...(query.supplierId ? { supplierId: query.supplierId } : {}), ...dateRange(query.from, query.to), lines: { some: { productName: containsCi(query.product.trim()) } } },
      include: withLines,
    });
    const all = rows.flatMap((row) => row.lines.filter((l) => productKey(l.productName) === wanted).map((l) => ({ row, line: l, date: effectiveDate(row) })));
    const kg = all.filter((x) => x.line.rateBasis === 'KG');
    const chosen = (kg.length ? kg : all).sort((a, b) => a.date.localeCompare(b.date) || a.row.createdAt.getTime() - b.row.createdAt.getTime());
    const sales = await salesFor(chosen.map((x) => x.row), query.product);
    const points = chosen.map((x) => ({
      sale: sales.get(x.row.id) ?? null,
      date: x.date, rate: num(x.line.rate), netWeight: x.line.netWeight === null ? null : num(x.line.netWeight),
      supplierId: x.row.supplierId, supplierName: x.row.supplier.name, invoiceId: x.row.id, invoiceNumber: x.row.invoiceNumber,
    }));
    const last = points[points.length - 1];
    if (!last) return { product: query.product.trim(), points, summary: null };
    const before = points.length > 1 ? points[points.length - 2]! : null;
    const rates = points.map((p) => p.rate);
    return {
      product: query.product.trim(),
      points,
      summary: {
        latest: last.rate, latestDate: last.date,
        previous: before?.rate ?? null, previousDate: before?.date ?? null,
        changePercent: before && before.rate > 0 ? Math.round(((last.rate - before.rate) / before.rate) * 10000) / 100 : null,
        lowest: Math.min(...rates), highest: Math.max(...rates), average: Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 10000) / 10000,
      },
    };
  },

  /** Every product with where its price stands: the latest rate, how it moved, the cheapest supplier, a small trend and what it was sold for. */
  async overview(query: PriceOverviewQuery): Promise<PriceOverviewItem[]> {
    const rows = await prisma.purchaseInvoice.findMany({
      where: { deletedAt: null, ...(query.supplierId ? { supplierId: query.supplierId } : {}), ...dateRange(query.from, query.to) },
      include: withLines,
    });
    const saleInvoices = await loadSaleInvoices([...new Set(rows.map((r) => r.invoiceId).filter((id): id is string => !!id))]);
    interface Point { date: string; at: number; rate: number; basis: string; supplierId: string; supplierName: string; sale: PriceSale | null }
    const groups = new Map<string, { product: string; points: Point[] }>();
    for (const row of rows) {
      const invoice = row.invoiceId ? saleInvoices.get(row.invoiceId) : undefined;
      for (const l of row.lines) {
        const key = productKey(l.productName);
        const group = groups.get(key) ?? { product: l.productName.trim(), points: [] };
        group.points.push({ date: effectiveDate(row), at: row.createdAt.getTime(), rate: num(l.rate), basis: l.rateBasis, supplierId: row.supplierId, supplierName: row.supplier.name, sale: invoice ? saleOf(invoice, l.productName) : null });
        groups.set(key, group);
      }
    }
    return [...groups.values()].map(({ product, points }): PriceOverviewItem => {
      const perKg = points.filter((p) => p.basis === 'KG');
      const chosen = (perKg.length ? perKg : points).sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at);
      const last = chosen[chosen.length - 1]!;
      const before = [...chosen.slice(0, -1)].reverse().find((p) => p.supplierId === last.supplierId);
      const latestBySupplier = new Map<string, Point>();
      for (const p of chosen) latestBySupplier.set(p.supplierId, p);
      const cheapest = latestBySupplier.size >= 2 ? [...latestBySupplier.values()].sort((a, b) => a.rate - b.rate)[0]! : null;
      const rates = chosen.map((p) => p.rate);
      const sold = [...chosen].reverse().find((p) => p.sale);
      return {
        product,
        purchases: chosen.length,
        suppliers: latestBySupplier.size,
        latest: { rate: last.rate, date: last.date, supplierName: last.supplierName },
        previousRate: before?.rate ?? null,
        changePercent: before && before.rate > 0 ? Math.round(((last.rate - before.rate) / before.rate) * 10000) / 100 : null,
        cheapest: cheapest ? { supplierName: cheapest.supplierName, rate: cheapest.rate } : null,
        lowest: Math.min(...rates),
        highest: Math.max(...rates),
        average: Math.round((rates.reduce((sum, r) => sum + r, 0) / rates.length) * 100) / 100,
        series: chosen.slice(-24).map((p) => ({ date: p.date, rate: p.rate })),
        sale: sold?.sale ? { invoiceId: sold.sale.invoiceId, invoiceNumber: sold.sale.invoiceNumber, currency: sold.sale.currency, rate: sold.sale.rate, rateInr: sold.sale.rateInr, buyRate: sold.rate, date: sold.date } : null,
      };
    }).sort((a, b) => a.product.localeCompare(b.product));
  },

  /** Every product that was ever bought, for the price tracker's picker. */
  async productNames(): Promise<{ product: string; lines: number }[]> {
    const groups = await prisma.purchaseLine.groupBy({ by: ['productName'], where: { purchaseInvoice: { deletedAt: null } }, _count: { _all: true } });
    const merged = new Map<string, { product: string; lines: number }>();
    for (const g of groups) {
      const key = productKey(g.productName);
      const entry = merged.get(key) ?? { product: g.productName.trim(), lines: 0 };
      entry.lines += g._count._all;
      merged.set(key, entry);
    }
    return [...merged.values()].sort((a, b) => a.product.localeCompare(b.product));
  },

  /** The latest rate each product was bought at (for the Products page). */
  async lastRates(): Promise<LastPurchaseRate[]> {
    const lines = await prisma.purchaseLine.findMany({
      where: { purchaseInvoice: { deletedAt: null } },
      include: { purchaseInvoice: { select: { invoiceDate: true, purchaseDate: true, createdAt: true, supplier: { select: { name: true } } } } },
      orderBy: { purchaseInvoice: { invoiceDate: 'desc' } },
      take: 3000,
    });
    const best = new Map<string, LastPurchaseRate & { at: string }>();
    for (const l of lines) {
      const key = productKey(l.productName);
      const date = effectiveDate(l.purchaseInvoice);
      const at = `${date}|${l.purchaseInvoice.createdAt.toISOString()}`;
      const current = best.get(key);
      if (current && current.at >= at) continue;
      best.set(key, { product: l.productName.trim(), rate: num(l.rate), rateBasis: l.rateBasis as 'KG' | 'UNIT', date, supplierName: l.purchaseInvoice.supplier.name, at });
    }
    return [...best.values()].map(({ at: _at, ...rest }) => rest);
  },
};

function invoiceData(dto: PurchaseInvoiceDto) {
  return {
    supplierId: dto.supplierId,
    invoiceNumber: dto.invoiceNumber,
    invoiceDate: day(dto.invoiceDate),
    purchaseDate: dto.purchaseDate ? day(dto.purchaseDate) : null,
    dueDate: dto.dueDate ? day(dto.dueDate) : null,
    subTotal: dto.subTotal, taxAmount: dto.taxAmount, freight: dto.freight, otherCharges: dto.otherCharges, total: dto.total,
    notes: dto.notes ?? null,
    sourceFileName: dto.sourceFileName ?? null,
    sourceHash: dto.sourceHash ?? null,
    invoiceId: dto.invoiceId ?? null,
  };
}

function linesData(dto: PurchaseInvoiceDto) {
  return dto.lines.map((l, index) => ({
    sortOrder: index,
    productName: l.productName,
    description: l.description ?? null,
    quantity: l.quantity ?? null,
    netWeight: l.netWeight ?? null,
    unit: l.unit ?? null,
    rate: l.rate,
    rateBasis: l.rateBasis,
    amount: l.amount,
  }));
}

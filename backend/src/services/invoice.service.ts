import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { currencyService } from './currency.service';
import { exporterService } from './exporter.service';
import { bankService } from './bank.service';
import { declarationService } from './declaration.service';
import { signService } from './sign.service';
import { DEFAULT_DECLARATION } from 'shared';
import type { CreateInvoiceDto, ListInvoicesQuery, PaginationMeta, UpdateInvoiceDto } from 'shared';
import { anyOfCi, ci, containsCi } from '../utils/caseInsensitive';

type InvoiceLineInput = CreateInvoiceDto['lineItems'][number];

function calculateLine(item: InvoiceLineInput) {
  const totalNetWeight = item.netWeightPerPackage * item.numberOfBoxes;
  const totalPerBox = item.netWeightPerPackage * item.ratePerKg;
  const amount = totalNetWeight * item.ratePerKg;

  return {
    marksAndNos: item.marksAndNos ?? null,
    containerNo: item.containerNo ?? null,
    descriptionOfGoods: item.descriptionOfGoods,
    netWeightPerPackage: new Decimal(item.netWeightPerPackage),
    numberOfBoxes: item.numberOfBoxes,
    totalNetWeight: new Decimal(totalNetWeight),
    ratePerKg: new Decimal(item.ratePerKg),
    totalPerBox: new Decimal(totalPerBox),
    amount: new Decimal(amount),
  };
}

/** Which invoice an actual invoice came from (and whether an invoice already has one), for the buttons and links. */
const actualLinks = {
  actuals: { where: { deletedAt: null }, select: { id: true, invoiceNumber: true }, take: 1 },
  actualOf: { select: { id: true, invoiceNumber: true } },
  // the party / custom partner of an invoice (an invoice has at most one): the copy made from it, or the invoice it was copied from
  counterparts: { where: { deletedAt: null }, select: { id: true, invoiceNumber: true, invoiceKind: true }, take: 1 },
  counterpartOf: { select: { id: true, invoiceNumber: true, invoiceKind: true } },
} as const;

/** "SMP-101" -> "SMP-101 (Custom)" or "SMP-101 (Party)". */
export const counterpartNumber = (number: string, kind: 'PARTY' | 'CUSTOM') => `${number} (${kind === 'CUSTOM' ? 'Custom' : 'Party'})`;

/** "SMP-DEMO-E" -> "ACTUAL SMP-DEMO-E". */
export const actualNumber = (invoiceNumber: string) => `ACTUAL ${invoiceNumber}`;

function calculateInvoiceTotals(lineItems: InvoiceLineInput[], roundOff: number) {
  const computed = lineItems.map((item) => ({
    totalBoxes: item.numberOfBoxes,
    totalNetWeight: item.netWeightPerPackage * item.numberOfBoxes,
    amount: item.netWeightPerPackage * item.numberOfBoxes * item.ratePerKg,
  }));

  const totalBoxes = computed.reduce((sum, item) => sum + item.totalBoxes, 0);
  const totalNetWeight = computed.reduce((sum, item) => sum + item.totalNetWeight, 0);
  const subTotal = computed.reduce((sum, item) => sum + item.amount, 0);
  const total = subTotal + roundOff;

  return { totalBoxes, totalNetWeight, subTotal, total };
}

/** Gross weight (goods plus packing) can never be below the nett weight. */
export function assertGrossAtLeastNet(gross: number | null | undefined, totalNetWeight: number) {
  if (gross !== null && gross !== undefined && gross + 1e-9 < totalNetWeight) {
    throw new AppError("Total gross weight can't be less than the total nett weight", 400, 'GROSS_WEIGHT_TOO_LOW');
  }
}

type ImporterSource = { name: string; address: string; contact: string | null; email: string | null };
type InvoiceSnapshotDto = {
  importerName?: string | undefined;
  importerAddress?: string | undefined;
  importerContact?: string | undefined;
  importerEmail?: string | undefined;
};

/**
 * The importer details to store on a new invoice: what the form sent (it is prefilled from the importer and can be
 * edited), or the importer's own details when the caller sent nothing. A blank name falls back to the importer's name
 * (an invoice always has one); a blank address/contact/email means "leave it empty".
 */
export function snapshotFromImporter(importer: ImporterSource, dto: InvoiceSnapshotDto) {
  const blankToNull = (v: string | undefined, fallback: string | null) => (v === undefined ? fallback : v.trim() || null);
  return {
    importerName: dto.importerName?.trim() || importer.name,
    importerAddress: blankToNull(dto.importerAddress, importer.address),
    importerContact: blankToNull(dto.importerContact, importer.contact),
    importerEmail: blankToNull(dto.importerEmail, importer.email),
  };
}

/**
 * What to change on an existing invoice. The saved copy is kept unless the form sends new values, or the invoice is
 * moved to a different importer (then it takes that importer's details). It is never refreshed from the importer.
 */
export function snapshotChanges(
  dto: InvoiceSnapshotDto,
  importer: ImporterSource,
  current: { importerName: string | null },
  importerChanged: boolean,
) {
  const out: Record<string, string | null> = {};
  const base = importerChanged ? snapshotFromImporter(importer, {}) : null;
  if (base) Object.assign(out, base);
  if (dto.importerName !== undefined) out['importerName'] = dto.importerName.trim() || (importerChanged ? importer.name : current.importerName ?? importer.name);
  if (dto.importerAddress !== undefined) out['importerAddress'] = dto.importerAddress.trim() || null;
  if (dto.importerContact !== undefined) out['importerContact'] = dto.importerContact.trim() || null;
  if (dto.importerEmail !== undefined) out['importerEmail'] = dto.importerEmail.trim() || null;
  return out;
}

/** A filter value arrives as one value or a list (and blank means "no filter"). */
function asList<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]).filter((v) => v !== '' && v !== undefined && v !== null);
}

/** Invoice numbers are unique whatever their capitals ("rg 1" and "RG 1" are the same number). */
const invoiceNumberTaken = async (invoiceNumber: string, exceptId?: string) =>
  (await prisma.invoice.count({ where: { invoiceNumber: ci(invoiceNumber), ...(exceptId ? { NOT: { id: exceptId } } : {}) } })) > 0;

/** One value stays a plain match; several become "any of these". */
const oneOrIn = <T>(list: T[]) => (list.length === 1 ? list[0]! : { in: list });

const dayAfter = (ymd: string) => new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)) + 1));

/** The filters of the invoice list (search, importers, currencies, dates, amount, route, product, exporter, type) as one database condition. */
async function whereFor(query: ListInvoicesQuery): Promise<Prisma.InvoiceWhereInput> {
  const search = query.search;
  const importerIds = asList(query.importerId);
  const currencies = asList(query.currency);
  // Query-string values can arrive as text ("2023"), and "2023" + 1 would be "20231", so convert explicitly.
  const years = asList(query.year).map(Number).filter((y) => y > 0);
  const months = asList(query.month).map(Number).filter((m) => m > 0);
  const and: Prisma.InvoiceWhereInput[] = [];

  // One year (with or without one month) is a plain date range. Months on their own, or several of anything, are
  // "that month in any year" which Prisma can't express, so the matching ids are looked up with a small raw query.
  let invoiceDate: Prisma.InvoiceWhereInput['invoiceDate'];
  let idsForMonth: string[] | undefined;
  const yearRange = (year: number, month?: number) => ({
    gte: new Date(Date.UTC(year, (month ?? 1) - 1, 1)),
    lt: month ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(year + 1, 0, 1)),
  });
  if (years.length === 1 && months.length <= 1) {
    invoiceDate = yearRange(years[0]!, months[0]);
  } else if (years.length === 0 && months.length === 1) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM invoices WHERE "deletedAt" IS NULL AND EXTRACT(MONTH FROM "invoiceDate") = ${months[0]}`;
    idsForMonth = rows.map((r) => r.id);
  } else {
    if (years.length > 0) and.push({ OR: years.map((y) => ({ invoiceDate: yearRange(y) })) });
    if (months.length > 0) {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM invoices WHERE "deletedAt" IS NULL AND EXTRACT(MONTH FROM "invoiceDate") IN (${Prisma.join(months)})`;
      and.push({ id: { in: rows.map((r) => r.id) } });
    }
  }

  if (query.dateFrom || query.dateTo) {
    and.push({
      invoiceDate: {
        ...(query.dateFrom ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) } : {}),
        ...(query.dateTo ? { lt: dayAfter(query.dateTo) } : {}),
      },
    });
  }

  const loading = asList(query.loadingPort);
  const discharge = asList(query.dischargePort);
  const countries = asList(query.country);
  const products = asList(query.product);
  const exporters = asList(query.exporter);
  if (loading.length) and.push(anyOfCi('portOfLoading', loading));
  // "to" a port: the port of discharge or the final destination
  if (discharge.length) and.push({ OR: [...anyOfCi('portOfDischarge', discharge).OR, ...anyOfCi('finalDestination', discharge).OR] });
  if (countries.length) and.push(anyOfCi('countryOfDestination', countries));
  if (products.length) and.push({ lineItems: { some: anyOfCi('descriptionOfGoods', products) } });
  if (exporters.length) and.push(anyOfCi('exporterName', exporters));

  const total = {
    ...(query.minTotal !== undefined && query.minTotal !== null ? { gte: Number(query.minTotal) } : {}),
    ...(query.maxTotal !== undefined && query.maxTotal !== null ? { lte: Number(query.maxTotal) } : {}),
  };

  return {
    deletedAt: null,
    // the hidden custom page of a BOTH invoice is never listed on its own
    isCompanion: false,
    ...(importerIds.length ? { importerId: oneOrIn(importerIds) } : {}),
    ...(currencies.length ? { currency: oneOrIn(currencies) } : {}),
    ...(invoiceDate ? { invoiceDate } : {}),
    ...(idsForMonth ? { id: { in: idsForMonth } } : {}),
    ...(Object.keys(total).length ? { total } : {}),
    ...(query.type === 'regular' ? { actualOfId: null } : query.type === 'actual' ? { actualOfId: { not: null } } : {}),
    ...(query.kind ? { invoiceKind: query.kind.toUpperCase() } : {}),
    ...(and.length ? { AND: and } : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: containsCi(search) },
            { importer: { name: containsCi(search) } },
            { importerName: containsCi(search) },
            { buyerName: containsCi(search) },
          ],
        }
      : {}),
  };
}

/** Most invoices one bulk action (delete, ZIP) works on, so a request never grows without limit. */
export const MAX_SELECTION = 200;

export const invoiceService = {
  async list(query: ListInvoicesQuery): Promise<{ data: unknown[]; meta: PaginationMeta }> {
    const page = Number.isFinite(Number(query.page)) ? Math.max(1, Math.floor(Number(query.page))) : 1;
    const limit = Number.isFinite(Number(query.limit)) ? Math.min(100, Math.max(1, Math.floor(Number(query.limit)))) : 20;
    const sort = query.sort === 'invoiceDate' || query.sort === 'invoiceNumber' || query.sort === 'total' ? query.sort : 'createdAt';
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const where = await whereFor(query);

    const [invoices, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        omit: { signImage: true },
        include: {
          importer: { select: { id: true, name: true, currency: true } },
          lineItems: true,
          ...actualLinks,
        },
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    // Flag invoices that can't be converted to the reporting currency (they are left out of dashboard revenue).
    let excludedIds = new Set<string>();
    try {
      const { convert } = await currencyService.buildConverter(invoices);
      excludedIds = new Set(invoices.filter((inv) => convert(inv) === null).map((inv) => inv.id));
    } catch (err) {
      logger.warn('Could not check exchange rates for invoice list', { error: (err as Error).message });
    }

    const totalPages = Math.ceil(total / limit);
    return {
      data: invoices.map((inv) => ({ ...inv, excludedFromRevenue: excludedIds.has(inv.id) })),
      meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  },

  async getById(id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        importer: true,
        landingLocation: true,
        loadingLocation: true,
        lineItems: true,
        ...actualLinks,
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    return invoice;
  },

  /**
   * Makes the "actual" invoice: a full copy named "ACTUAL <number>", linked back to the original.
   * Only one per invoice, and an actual invoice can't have an actual of its own.
   */
  async createActual(id: string) {
    const original = await prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: { lineItems: true, actuals: { where: { deletedAt: null }, select: { id: true } } },
    });
    if (!original) throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    if (original.actualOfId) throw new AppError('This already is an actual invoice', 400, 'ALREADY_ACTUAL');
    if (original.invoiceKind === 'CUSTOM') throw new AppError('A custom invoice cannot have an actual invoice', 400, 'CUSTOM_NO_ACTUAL');
    if (original.actuals.length > 0) throw new AppError('An actual invoice was already created for this invoice', 409, 'ACTUAL_EXISTS');

    const invoiceNumber = actualNumber(original.invoiceNumber);
    if (await invoiceNumberTaken(invoiceNumber)) {
      throw new AppError(`An invoice named ${invoiceNumber} already exists (it may be in the Recycle Bin)`, 409, 'ACTUAL_NUMBER_TAKEN');
    }

    const { id: _id, createdAt: _created, updatedAt: _updated, deletedAt: _deleted, lineItems, actuals: _actuals, ...fields } = original;
    return prisma.invoice.create({
      data: {
        ...fields,
        invoiceNumber,
        actualOfId: original.id,
        // an actual invoice is not a party / custom partner of anything, and prints the number it was made from
        counterpartOfId: null,
        isCompanion: false,
        // an actual made from a BOTH invoice is built from its party page and is a plain invoice
        ...(original.invoiceKind === 'BOTH' ? { invoiceKind: 'NORMAL' } : {}),
        printedNumber: original.printedNumber ?? original.invoiceNumber,
        lineItems: { create: lineItems.map(({ id: _lineId, invoiceId: _invoiceId, ...line }) => line) },
      },
      include: { importer: true, lineItems: true },
    });
  },

  /**
   * Makes the other kind of this invoice: a custom invoice from a party invoice, or a party invoice from a custom one.
   * It is a full copy named "<number> (Custom)" or "<number> (Party)", prints the same number as the invoice it came from,
   * and is its partner. An invoice can have only one partner.
   */
  async createCounterpart(id: string) {
    const source = await prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: { lineItems: true, counterparts: { where: { deletedAt: null }, select: { id: true } } },
    });
    if (!source) throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    if (source.invoiceKind !== 'PARTY' && source.invoiceKind !== 'CUSTOM') {
      throw new AppError('Only a party or custom invoice can make its partner. Set the invoice type to Party or Custom first.', 400, 'NOT_PARTY_OR_CUSTOM');
    }
    if (source.actualOfId) throw new AppError('An actual invoice cannot have a party or custom invoice', 400, 'ACTUAL_NO_COUNTERPART');
    if (source.counterpartOfId || source.counterparts.length > 0) {
      throw new AppError('This invoice already has its party / custom partner', 409, 'COUNTERPART_EXISTS');
    }

    const kind = source.invoiceKind === 'CUSTOM' ? 'PARTY' : 'CUSTOM';
    const invoiceNumber = counterpartNumber(source.invoiceNumber, kind);
    if (await invoiceNumberTaken(invoiceNumber)) {
      throw new AppError(`An invoice named ${invoiceNumber} already exists (it may be in the Recycle Bin)`, 409, 'COUNTERPART_NUMBER_TAKEN');
    }

    const { id: _id, createdAt: _created, updatedAt: _updated, deletedAt: _deleted, lineItems, counterparts: _counterparts, ...fields } = source;
    return prisma.invoice.create({
      data: {
        ...fields,
        invoiceNumber,
        invoiceKind: kind,
        counterpartOfId: source.id,
        printedNumber: source.printedNumber ?? source.invoiceNumber,
        lineItems: { create: lineItems.map(({ id: _lineId, invoiceId: _invoiceId, ...line }) => line) },
      },
      include: { importer: true, lineItems: true },
    });
  },

  /** Headline numbers for the Invoices page: counts and the total value in the reporting currency. */
  async summary() {
    // The database adds up invoices that share a day, currency and manual rate (one exchange rate applies to
    // all of them), so memory stays small however many invoices there are.
    const groups = await prisma.invoice.groupBy({
      by: ['invoiceDate', 'currency', 'manualRate', 'manualRateBase'],
      // an "actual" invoice and a party / custom partner are copies of an original, so they are left out of the totals (nothing counted twice)
      where: { deletedAt: null, actualOfId: null, counterpartOfId: null },
      _sum: { total: true },
      _count: { _all: true },
    });
    const rows = groups.map((g) => ({
      invoiceDate: g.invoiceDate,
      currency: g.currency,
      manualRate: g.manualRate,
      manualRateBase: g.manualRateBase,
      total: g._sum.total ?? 0,
      count: g._count._all,
    }));
    const { baseCurrency, convert } = await currencyService.buildConverter(rows);

    const now = new Date();
    let total = 0;
    let thisMonth = 0;
    let totalValue = 0;
    let monthValue = 0;
    let notInRevenue = 0;
    const years = new Set<number>();
    const currencies = new Set<string>();
    for (const row of rows) {
      const d = new Date(row.invoiceDate);
      const inThisMonth = d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
      total += row.count;
      if (inThisMonth) thisMonth += row.count;
      years.add(d.getUTCFullYear());
      currencies.add(row.currency);
      const value = convert(row);
      if (value === null) notInRevenue += row.count;
      else {
        totalValue += value;
        if (inThisMonth) monthValue += value;
      }
    }
    return {
      total,
      thisMonth,
      totalValue,
      monthValue,
      baseCurrency,
      notInRevenue,
      // what the Invoices page can filter by
      years: [...years].sort((a, b) => b - a),
      currencies: [...currencies].sort(),
    };
  },

  /** Invoice plus how it is valued in the reporting currency (used by the detail page). */
  async getByIdWithConversion(id: string) {
    const invoice = await this.getById(id);
    const { baseCurrency, convertDetailed } = await currencyService.buildConverter([invoice]);
    const result = convertDetailed(invoice);
    return {
      ...invoice,
      conversion: {
        baseCurrency,
        source: result?.source ?? ('missing' as const),
        rate: result?.rate ?? null,
        value: result?.value ?? null,
        provider: result?.provider ?? null,
      },
    };
  },

  /** Stores a user-entered exchange rate (reporting currency per 1 invoice-currency unit) for this invoice. */
  async setManualRate(id: string, rate: number) {
    const invoice = await this.getById(id);
    const base = await currencyService.getBaseCurrency();
    if (invoice.currency === base) {
      throw new AppError(`Invoice is already in ${base}, no exchange rate is needed`, 400, 'RATE_NOT_NEEDED');
    }
    await prisma.invoice.update({
      where: { id },
      data: { manualRate: new Decimal(rate), manualRateBase: base, manualRateSetAt: new Date() },
    });
    return this.getByIdWithConversion(id);
  },

  async clearManualRate(id: string) {
    await this.getById(id);
    await prisma.invoice.update({ where: { id }, data: { manualRate: null, manualRateBase: null, manualRateSetAt: null } });
    return this.getByIdWithConversion(id);
  },

  /**
   * Creates an invoice. A BOTH invoice is saved as two rows: the party invoice (kind BOTH, the one everyone sees) and its custom page,
   * a hidden companion row (kind CUSTOM) that carries the content of the custom page and points back at it.
   */
  async create(dto: CreateInvoiceDto) {
    if (dto.invoiceKind !== 'BOTH') return this.createRow(dto);

    const { customVersion, ...partyDto } = dto;
    if (!customVersion) throw new AppError('A party and custom invoice needs the content of its custom page', 400, 'CUSTOM_VERSION_REQUIRED');
    const companionNumber = counterpartNumber(dto.invoiceNumber, 'CUSTOM');
    if (await invoiceNumberTaken(companionNumber)) {
      throw new AppError(`An invoice named ${companionNumber} already exists (it may be in the Recycle Bin)`, 409, 'COUNTERPART_NUMBER_TAKEN');
    }

    const main = await this.createRow(partyDto);
    try {
      await this.createRow(
        { ...customVersion, importerId: dto.importerId, invoiceNumber: companionNumber, invoiceKind: 'CUSTOM' },
        { counterpartOfId: main.id, isCompanion: true, printedNumber: dto.invoiceNumber },
      );
    } catch (error) {
      // never leave a half-made pair behind
      await prisma.$transaction([prisma.lineItem.deleteMany({ where: { invoiceId: main.id } }), prisma.invoice.delete({ where: { id: main.id } })]);
      throw error;
    }
    return main;
  },

  /** One invoice row; `extra` is for the hidden custom page of a BOTH invoice. */
  async createRow(dto: Omit<CreateInvoiceDto, 'customVersion'>, extra: { counterpartOfId?: string; isCompanion?: boolean; printedNumber?: string } = {}) {
    if (await invoiceNumberTaken(dto.invoiceNumber)) {
      throw new AppError(`An invoice numbered ${dto.invoiceNumber} already exists (it may be in the Recycle Bin)`, 409, 'INVOICE_NUMBER_TAKEN');
    }
    const importer = await prisma.importer.findFirst({
      where: { id: dto.importerId, deletedAt: null },
      include: { landingLocations: true, loadingLocations: true },
    });

    if (!importer) {
      throw new AppError('Importer not found', 404, 'IMPORTER_NOT_FOUND');
    }

    if (!importer.isActive) {
      throw new AppError('This importer is marked as not needed, so no new invoices can be created for it', 400, 'IMPORTER_INACTIVE');
    }

    const selectedLanding = dto.landingLocationId
      ? importer.landingLocations.find((item) => item.id === dto.landingLocationId)
      : undefined;

    const selectedLoading = dto.loadingLocationId
      ? importer.loadingLocations.find((item) => item.id === dto.loadingLocationId)
      : undefined;

    if (dto.landingLocationId && !selectedLanding) {
      throw new AppError('Invalid landing location for importer', 400, 'INVALID_LANDING_LOCATION');
    }

    if (dto.loadingLocationId && !selectedLoading) {
      throw new AppError('Invalid loading location for importer', 400, 'INVALID_LOADING_LOCATION');
    }

    // No exporter sent: start from the default profile (the invoice keeps its own copy from here on)
    const hasExporter = dto.exporterName || dto.exporterAddress || dto.exporterContact || dto.exporterEmail;
    const fallback = hasExporter ? null : await exporterService.getDefault();

    // Same for the bank account: copied from the default when the form sent none
    const hasBank = dto.bankName || dto.bankAccountNumber || dto.bankIfscCode || dto.bankSwiftCode;
    const bankFallback = hasBank ? null : await bankService.getDefault();

    // And the seal & sign
    const signFallback = dto.signImage ? null : await signService.getDefault();

    // And the declaration wording
    const declarationFallback = dto.declaration ? null : await declarationService.getDefault();

    const roundOff = dto.roundOff ?? 0;
    const totals = calculateInvoiceTotals(dto.lineItems, roundOff);
    assertGrossAtLeastNet(dto.totalGrossWeight, totals.totalNetWeight);

    return prisma.invoice.create({
      data: {
        invoiceNumber: dto.invoiceNumber,
        invoiceKind: dto.invoiceKind ?? 'NORMAL',
        ...(extra.counterpartOfId ? { counterpartOfId: extra.counterpartOfId } : {}),
        ...(extra.isCompanion ? { isCompanion: true } : {}),
        ...(extra.printedNumber ? { printedNumber: extra.printedNumber } : {}),
        invoiceDate: new Date(dto.invoiceDate),
        importerId: dto.importerId,
        landingLocationId: dto.landingLocationId ?? null,
        loadingLocationId: dto.loadingLocationId ?? null,
        exportersRef: dto.exportersRef ?? null,
        otherReferences: dto.otherReferences ?? null,
        awbNumber: dto.awbNumber ?? null,
        buyersOrder: dto.buyersOrder ?? null,
        preCarriageBy: dto.preCarriageBy,
        placeOfReceiptByPreCarrier: dto.placeOfReceiptByPreCarrier,
        vesselFlightNo: dto.vesselFlightNo,
        portOfLoading: dto.portOfLoading ?? selectedLoading?.portOfLoading ?? null,
        portOfDischarge: dto.portOfDischarge ?? selectedLanding?.portOfDischarge ?? null,
        finalDestination: dto.finalDestination ?? selectedLanding?.finalDestination ?? null,
        buyerName: dto.buyerName ?? importer.buyerName,
        ...snapshotFromImporter(importer, dto),
        countryOfOrigin: dto.countryOfOrigin ?? selectedLoading?.countryOfOrigin ?? null,
        countryOfDestination: dto.countryOfDestination ?? selectedLanding?.countryOfDestination ?? null,
        descriptionOfGoods: dto.descriptionOfGoods,
        hsCode: dto.hsCode,
        termsOfDelivery: dto.termsOfDelivery,
        termsOfPayment: dto.termsOfPayment,
        currency: dto.currency,
        exporterName: dto.exporterName ?? fallback?.name ?? null,
        exporterAddress: dto.exporterAddress ?? fallback?.address ?? null,
        exporterContact: dto.exporterContact ?? fallback?.contact ?? null,
        exporterEmail: dto.exporterEmail ?? fallback?.email ?? null,
        bankName: dto.bankName ?? bankFallback?.bankName ?? null,
        bankAccountNumber: dto.bankAccountNumber ?? bankFallback?.accountNumber ?? null,
        bankIfscCode: dto.bankIfscCode ?? bankFallback?.ifscCode ?? null,
        bankSwiftCode: dto.bankSwiftCode ?? bankFallback?.swiftCode ?? null,
        signName: dto.signName ?? signFallback?.name ?? null,
        signImage: dto.signImage ?? signFallback?.image ?? null,
        totalBoxes: totals.totalBoxes,
        totalNetWeight: new Decimal(totals.totalNetWeight),
        totalGrossWeight: dto.totalGrossWeight !== undefined ? new Decimal(dto.totalGrossWeight) : null,
        subTotal: new Decimal(totals.subTotal),
        roundOff: new Decimal(roundOff),
        total: new Decimal(totals.total),
        amountInWords: dto.amountInWords ?? null,
        notes: dto.notes ?? null,
        declaration: dto.declaration || declarationFallback?.text || DEFAULT_DECLARATION,
        lineItems: {
          create: dto.lineItems.map(calculateLine),
        },
      },
      include: {
        importer: true,
        landingLocation: true,
        loadingLocation: true,
        lineItems: true,
      },
    });
  },

  /** Updates an invoice. For a BOTH invoice the custom page (customVersion) is saved on its hidden companion row, in step with the party page. */
  async update(id: string, dto: UpdateInvoiceDto) {
    const { customVersion, ...partyDto } = dto;
    const updated = await this.updateRow(id, partyDto);

    const companion = await prisma.invoice.findFirst({ where: { counterpartOfId: id, isCompanion: true, deletedAt: null }, select: { id: true } });
    if (companion) {
      // the number and importer are shared with the party page
      if (partyDto.invoiceNumber !== undefined) {
        await prisma.invoice.update({ where: { id: companion.id }, data: { invoiceNumber: counterpartNumber(partyDto.invoiceNumber, 'CUSTOM'), printedNumber: partyDto.invoiceNumber } });
      }
      if (customVersion || partyDto.importerId) {
        await this.updateRow(companion.id, { ...(customVersion ?? {}), ...(partyDto.importerId ? { importerId: partyDto.importerId } : {}) });
      }
    }
    return updated;
  },

  async updateRow(id: string, dto: Omit<UpdateInvoiceDto, 'customVersion'>) {
    const current = await this.getById(id);
    if (dto.invoiceNumber !== undefined && dto.invoiceNumber.toLowerCase() !== current.invoiceNumber.toLowerCase() && (await invoiceNumberTaken(dto.invoiceNumber, id))) {
      throw new AppError(`An invoice numbered ${dto.invoiceNumber} already exists (it may be in the Recycle Bin)`, 409, 'INVOICE_NUMBER_TAKEN');
    }

    const importerId = dto.importerId ?? current.importerId;
    const importerChanged = importerId !== current.importerId;
    // An invoice keeps working after its importer is deleted (it has its own copy of the details), so only a
    // *new* importer has to be live.
    const importer = await prisma.importer.findFirst({
      where: { id: importerId, ...(importerChanged ? { deletedAt: null } : {}) },
      include: { landingLocations: true, loadingLocations: true },
    });

    if (!importer) {
      throw new AppError('Importer not found', 404, 'IMPORTER_NOT_FOUND');
    }

    if (!importer.isActive && importerChanged) {
      throw new AppError('This importer is marked as not needed, so invoices cannot be moved to it', 400, 'IMPORTER_INACTIVE');
    }

    const selectedLanding = dto.landingLocationId
      ? importer.landingLocations.find((item) => item.id === dto.landingLocationId)
      : undefined;

    const selectedLoading = dto.loadingLocationId
      ? importer.loadingLocations.find((item) => item.id === dto.loadingLocationId)
      : undefined;

    if (dto.landingLocationId && !selectedLanding) {
      throw new AppError('Invalid landing location for importer', 400, 'INVALID_LANDING_LOCATION');
    }

    if (dto.loadingLocationId && !selectedLoading) {
      throw new AppError('Invalid loading location for importer', 400, 'INVALID_LOADING_LOCATION');
    }

    const nextRoundOff = dto.roundOff ?? Number(current.roundOff);
    const nextLineItems = dto.lineItems ?? current.lineItems.map((line) => ({
      marksAndNos: line.marksAndNos ?? undefined,
      containerNo: line.containerNo ?? undefined,
      descriptionOfGoods: line.descriptionOfGoods,
      netWeightPerPackage: Number(line.netWeightPerPackage),
      numberOfBoxes: line.numberOfBoxes,
      ratePerKg: Number(line.ratePerKg),
    }));

    const totals = calculateInvoiceTotals(nextLineItems, nextRoundOff);
    assertGrossAtLeastNet(dto.totalGrossWeight ?? (current.totalGrossWeight === null ? null : Number(current.totalGrossWeight)), totals.totalNetWeight);

    return prisma.$transaction(async (tx) => {
      if (dto.lineItems) {
        await tx.lineItem.deleteMany({ where: { invoiceId: id } });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          ...(dto.invoiceNumber !== undefined ? { invoiceNumber: dto.invoiceNumber } : {}),
          ...(dto.invoiceDate !== undefined ? { invoiceDate: new Date(dto.invoiceDate) } : {}),
          ...(dto.importerId !== undefined ? { importerId: dto.importerId } : {}),
          ...(dto.landingLocationId !== undefined ? { landingLocationId: dto.landingLocationId } : {}),
          ...(dto.loadingLocationId !== undefined ? { loadingLocationId: dto.loadingLocationId } : {}),
          ...(dto.exportersRef !== undefined ? { exportersRef: dto.exportersRef } : {}),
          ...(dto.otherReferences !== undefined ? { otherReferences: dto.otherReferences } : {}),
          ...(dto.awbNumber !== undefined ? { awbNumber: dto.awbNumber } : {}),
          ...(dto.buyersOrder !== undefined ? { buyersOrder: dto.buyersOrder } : {}),
          ...(dto.preCarriageBy !== undefined ? { preCarriageBy: dto.preCarriageBy } : {}),
          ...(dto.placeOfReceiptByPreCarrier !== undefined
            ? { placeOfReceiptByPreCarrier: dto.placeOfReceiptByPreCarrier }
            : {}),
          ...(dto.vesselFlightNo !== undefined ? { vesselFlightNo: dto.vesselFlightNo } : {}),
          ...(dto.portOfLoading !== undefined
            ? { portOfLoading: dto.portOfLoading }
            : selectedLoading
              ? { portOfLoading: selectedLoading.portOfLoading }
              : {}),
          ...(dto.portOfDischarge !== undefined
            ? { portOfDischarge: dto.portOfDischarge }
            : selectedLanding
              ? { portOfDischarge: selectedLanding.portOfDischarge }
              : {}),
          ...(dto.finalDestination !== undefined
            ? { finalDestination: dto.finalDestination }
            : selectedLanding
              ? { finalDestination: selectedLanding.finalDestination }
              : {}),
          ...(dto.buyerName !== undefined ? { buyerName: dto.buyerName } : {}),
          ...snapshotChanges(dto, importer, current, importerChanged),
          ...(dto.countryOfOrigin !== undefined
            ? { countryOfOrigin: dto.countryOfOrigin }
            : selectedLoading
              ? { countryOfOrigin: selectedLoading.countryOfOrigin }
              : {}),
          ...(dto.countryOfDestination !== undefined
            ? { countryOfDestination: dto.countryOfDestination }
            : selectedLanding
              ? { countryOfDestination: selectedLanding.countryOfDestination }
              : {}),
          ...(dto.descriptionOfGoods !== undefined ? { descriptionOfGoods: dto.descriptionOfGoods } : {}),
          ...(dto.hsCode !== undefined ? { hsCode: dto.hsCode } : {}),
          ...(dto.termsOfDelivery !== undefined ? { termsOfDelivery: dto.termsOfDelivery } : {}),
          ...(dto.termsOfPayment !== undefined ? { termsOfPayment: dto.termsOfPayment } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
          ...(dto.exporterName !== undefined ? { exporterName: dto.exporterName } : {}),
          ...(dto.exporterAddress !== undefined ? { exporterAddress: dto.exporterAddress } : {}),
          ...(dto.exporterContact !== undefined ? { exporterContact: dto.exporterContact } : {}),
          ...(dto.exporterEmail !== undefined ? { exporterEmail: dto.exporterEmail } : {}),
          ...(dto.bankName !== undefined ? { bankName: dto.bankName } : {}),
          ...(dto.bankAccountNumber !== undefined ? { bankAccountNumber: dto.bankAccountNumber } : {}),
          ...(dto.bankIfscCode !== undefined ? { bankIfscCode: dto.bankIfscCode } : {}),
          ...(dto.bankSwiftCode !== undefined ? { bankSwiftCode: dto.bankSwiftCode } : {}),
          ...(dto.signName !== undefined ? { signName: dto.signName } : {}),
          ...(dto.signImage !== undefined ? { signImage: dto.signImage } : {}),
          ...(dto.totalGrossWeight !== undefined
            ? { totalGrossWeight: dto.totalGrossWeight !== null ? new Decimal(dto.totalGrossWeight) : null }
            : {}),
          ...(dto.amountInWords !== undefined ? { amountInWords: dto.amountInWords } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.declaration !== undefined ? { declaration: dto.declaration || DEFAULT_DECLARATION } : {}),
          totalBoxes: totals.totalBoxes,
          totalNetWeight: new Decimal(totals.totalNetWeight),
          subTotal: new Decimal(totals.subTotal),
          roundOff: new Decimal(nextRoundOff),
          total: new Decimal(totals.total),
          ...(dto.lineItems ? { lineItems: { create: dto.lineItems.map(calculateLine) } } : {}),
        },
        include: {
          importer: true,
          landingLocation: true,
          loadingLocation: true,
          lineItems: true,
        },
      });
    });
  },

  /** The values the filter panel can offer: only things that actually appear on some invoice. */
  async filterOptions() {
    const live = { deletedAt: null, isCompanion: false };
    const [years, currencies, loading, discharge, finals, countries, exporters, products] = await Promise.all([
      prisma.$queryRaw<Array<{ year: number }>>`SELECT DISTINCT EXTRACT(YEAR FROM "invoiceDate")::int AS year FROM invoices WHERE "deletedAt" IS NULL AND "isCompanion" = false`,
      prisma.invoice.findMany({ where: live, select: { currency: true }, distinct: ['currency'] }),
      prisma.invoice.findMany({ where: live, select: { portOfLoading: true }, distinct: ['portOfLoading'] }),
      prisma.invoice.findMany({ where: live, select: { portOfDischarge: true }, distinct: ['portOfDischarge'] }),
      prisma.invoice.findMany({ where: live, select: { finalDestination: true }, distinct: ['finalDestination'] }),
      prisma.invoice.findMany({ where: live, select: { countryOfDestination: true }, distinct: ['countryOfDestination'] }),
      prisma.invoice.findMany({ where: live, select: { exporterName: true }, distinct: ['exporterName'] }),
      prisma.lineItem.findMany({ where: { invoice: live }, select: { descriptionOfGoods: true }, distinct: ['descriptionOfGoods'] }),
    ]);
    // the same port or name can be saved in different capitals: keep one of each, sorted
    const unique = (values: Array<string | null | undefined>, fold: (v: string) => string) => {
      const seen = new Map<string, string>();
      for (const raw of values) {
        const value = raw?.trim();
        if (value && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), fold(value));
      }
      return [...seen.values()].sort((a, b) => a.localeCompare(b));
    };
    return {
      years: years.map((r) => Number(r.year)).sort((a, b) => b - a),
      currencies: unique(currencies.map((r) => r.currency), (v) => v.toUpperCase()),
      loadingPorts: unique(loading.map((r) => r.portOfLoading), (v) => v.toUpperCase()),
      dischargePorts: unique([...discharge.map((r) => r.portOfDischarge), ...finals.map((r) => r.finalDestination)], (v) => v.toUpperCase()),
      countries: unique(countries.map((r) => r.countryOfDestination), (v) => v),
      exporters: unique(exporters.map((r) => r.exporterName), (v) => v),
      products: unique(products.map((r) => r.descriptionOfGoods), (v) => v),
    };
  },

  /** Every invoice matching the list filters (newest first), for "select all matching". Capped so one request stays small. */
  async listIds(query: ListInvoicesQuery, cap = MAX_SELECTION) {
    const rows = await prisma.invoice.findMany({ where: await whereFor(query), select: { id: true }, orderBy: { createdAt: 'desc' }, take: cap + 1 });
    return { ids: rows.slice(0, cap).map((r) => r.id), truncated: rows.length > cap };
  },

  /** An invoice and, for a BOTH invoice, its hidden custom page: what the PDF, Excel, ZIP and share documents are built from. */
  async getWithCompanion(id: string) {
    const invoice = await this.getById(id);
    const companionId = invoice.invoiceKind === 'BOTH' ? invoice.counterparts?.[0]?.id : undefined;
    const companion = companionId ? await this.getById(companionId) : null;
    return { invoice, companion };
  },

  /** Several invoices (each with its hidden custom page, if any) in two queries instead of one set per invoice. */
  async getManyWithCompanions(ids: string[]) {
    const include = { importer: true, landingLocation: true, loadingLocation: true, lineItems: true, ...actualLinks } as const;
    const invoices = await prisma.invoice.findMany({ where: { id: { in: ids }, deletedAt: null }, include });
    const byId = new Map(invoices.map((inv) => [inv.id, inv]));
    for (const id of ids) if (!byId.has(id)) throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');

    const companionIds = new Set(
      invoices.filter((inv) => inv.invoiceKind === 'BOTH').map((inv) => inv.counterparts?.[0]?.id).filter((c): c is string => !!c),
    );
    const companions = companionIds.size ? await prisma.invoice.findMany({ where: { id: { in: [...companionIds] }, deletedAt: null }, include }) : [];
    const companionById = new Map(companions.map((c) => [c.id, c]));
    return ids.map((id) => {
      const invoice = byId.get(id)!;
      const companionId = invoice.invoiceKind === 'BOTH' ? invoice.counterparts?.[0]?.id : undefined;
      return { invoice, companion: (companionId && companionById.get(companionId)) || null };
    });
  },

  /** Deletes (to the Recycle Bin) all given invoices at once. Returns the ids deleted and the ids that weren't found. */
  async softDeleteMany(ids: string[]) {
    const live = await prisma.invoice.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } });
    const liveIds = live.map((r) => r.id);
    const now = new Date();
    if (liveIds.length) {
      // a BOTH invoice takes its hidden custom page with it
      await prisma.$transaction([
        prisma.invoice.updateMany({ where: { counterpartOfId: { in: liveIds }, isCompanion: true, deletedAt: null }, data: { deletedAt: now } }),
        prisma.invoice.updateMany({ where: { id: { in: liveIds } }, data: { deletedAt: now } }),
      ]);
    }
    const found = new Set(liveIds);
    return { deleted: liveIds, missing: ids.filter((id) => !found.has(id)) };
  },

  async softDelete(id: string) {
    await this.getById(id);
    const now = new Date();
    // a BOTH invoice takes its hidden custom page with it
    await prisma.invoice.updateMany({ where: { counterpartOfId: id, isCompanion: true, deletedAt: null }, data: { deletedAt: now } });
    return prisma.invoice.update({ where: { id }, data: { deletedAt: now } });
  },
};

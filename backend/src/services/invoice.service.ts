import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { currencyService } from './currency.service';
import { exporterService } from './exporter.service';
import { bankService } from './bank.service';
import { signService } from './sign.service';
import { DEFAULT_DECLARATION } from 'shared';
import type { CreateInvoiceDto, ListInvoicesQuery, PaginationMeta, UpdateInvoiceDto } from 'shared';

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

export const invoiceService = {
  async list(query: ListInvoicesQuery): Promise<{ data: unknown[]; meta: PaginationMeta }> {
    const page = Number.isFinite(Number(query.page)) ? Math.max(1, Math.floor(Number(query.page))) : 1;
    const limit = Number.isFinite(Number(query.limit)) ? Math.min(100, Math.max(1, Math.floor(Number(query.limit)))) : 20;
    const search = query.search;
    const sort = query.sort === 'invoiceDate' || query.sort === 'invoiceNumber' || query.sort === 'total' ? query.sort : 'createdAt';
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const importerId = query.importerId;
    // Query-string values can arrive as text ("2023"), and "2023" + 1 would be "20231", so convert explicitly.
    const year = query.year !== undefined && query.year !== null ? Number(query.year) : undefined;
    const month = query.month !== undefined && query.month !== null ? Number(query.month) : undefined;
    const { currency } = query;

    // A year (with or without a month) is a plain date range. A month on its own means "that month in any year",
    // which Prisma can't express, so the matching ids are looked up with a small raw query.
    let invoiceDate: Prisma.InvoiceWhereInput['invoiceDate'];
    let idsForMonth: string[] | undefined;
    if (year) {
      const start = new Date(Date.UTC(year, (month ?? 1) - 1, 1));
      const end = month ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(year + 1, 0, 1));
      invoiceDate = { gte: start, lt: end };
    } else if (month) {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM invoices WHERE deletedAt IS NULL AND MONTH(invoiceDate) = ${month}`;
      idsForMonth = rows.map((r) => r.id);
    }

    const where: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      ...(importerId ? { importerId } : {}),
      ...(currency ? { currency } : {}),
      ...(invoiceDate ? { invoiceDate } : {}),
      ...(idsForMonth ? { id: { in: idsForMonth } } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search } },
              { importer: { name: { contains: search } } },
              { importerName: { contains: search } },
              { buyerName: { contains: search } },
            ],
          }
        : {}),
    };

    const [invoices, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        omit: { signImage: true },
        include: {
          importer: { select: { id: true, name: true, currency: true } },
          lineItems: true,
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
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    return invoice;
  },

  /** Headline numbers for the Invoices page: counts and the total value in the reporting currency. */
  async summary() {
    const invoices = await prisma.invoice.findMany({
      where: { deletedAt: null },
      select: { invoiceDate: true, total: true, currency: true, manualRate: true, manualRateBase: true },
    });
    const { baseCurrency, convert } = await currencyService.buildConverter(invoices);

    const now = new Date();
    let thisMonth = 0;
    let totalValue = 0;
    let monthValue = 0;
    let notInRevenue = 0;
    const years = new Set<number>();
    const currencies = new Set<string>();
    for (const inv of invoices) {
      const d = new Date(inv.invoiceDate);
      const inThisMonth = d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
      if (inThisMonth) thisMonth += 1;
      years.add(d.getUTCFullYear());
      currencies.add(inv.currency);
      const value = convert(inv);
      if (value === null) notInRevenue += 1;
      else {
        totalValue += value;
        if (inThisMonth) monthValue += value;
      }
    }
    return {
      total: invoices.length,
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

  async create(dto: CreateInvoiceDto) {
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

    const roundOff = dto.roundOff ?? 0;
    const totals = calculateInvoiceTotals(dto.lineItems, roundOff);
    assertGrossAtLeastNet(dto.totalGrossWeight, totals.totalNetWeight);

    return prisma.invoice.create({
      data: {
        invoiceNumber: dto.invoiceNumber,
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
        declaration: dto.declaration || DEFAULT_DECLARATION,
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

  async update(id: string, dto: UpdateInvoiceDto) {
    const current = await this.getById(id);

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

  async softDelete(id: string) {
    await this.getById(id);
    return prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};

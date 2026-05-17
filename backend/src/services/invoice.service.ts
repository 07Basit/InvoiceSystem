import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
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

export const invoiceService = {
  async list(query: ListInvoicesQuery): Promise<{ data: unknown[]; meta: PaginationMeta }> {
    const page = Number.isFinite(Number(query.page)) ? Math.max(1, Math.floor(Number(query.page))) : 1;
    const limit = Number.isFinite(Number(query.limit)) ? Math.min(100, Math.max(1, Math.floor(Number(query.limit)))) : 20;
    const search = query.search;
    const sort = query.sort === 'invoiceDate' || query.sort === 'invoiceNumber' || query.sort === 'total' ? query.sort : 'createdAt';
    const order = query.order === 'asc' ? 'asc' : 'desc';
    const status = query.status;
    const importerId = query.importerId;

    const where: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(importerId ? { importerId } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { importer: { name: { contains: search, mode: 'insensitive' } } },
              { buyerName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [invoices, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
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

    const totalPages = Math.ceil(total / limit);
    return {
      data: invoices,
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

  async create(dto: CreateInvoiceDto) {
    const importer = await prisma.importer.findFirst({
      where: { id: dto.importerId, deletedAt: null },
      include: { landingLocations: true, loadingLocations: true },
    });

    if (!importer) {
      throw new AppError('Importer not found', 404, 'IMPORTER_NOT_FOUND');
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

    const roundOff = dto.roundOff ?? 0;
    const totals = calculateInvoiceTotals(dto.lineItems, roundOff);

    return prisma.invoice.create({
      data: {
        invoiceNumber: dto.invoiceNumber,
        invoiceDate: new Date(dto.invoiceDate),
        status: dto.status,
        importerId: dto.importerId,
        landingLocationId: dto.landingLocationId ?? null,
        loadingLocationId: dto.loadingLocationId ?? null,
        exportersRef: dto.exportersRef ?? null,
        otherReferences: dto.otherReferences ?? null,
        awbNumber: dto.awbNumber ?? null,
        preCarriageBy: dto.preCarriageBy,
        placeOfReceiptByPreCarrier: dto.placeOfReceiptByPreCarrier,
        vesselFlightNo: dto.vesselFlightNo,
        portOfLoading: dto.portOfLoading ?? selectedLoading?.portOfLoading ?? null,
        portOfDischarge: dto.portOfDischarge ?? selectedLanding?.portOfDischarge ?? null,
        finalDestination: dto.finalDestination ?? selectedLanding?.finalDestination ?? null,
        buyerName: dto.buyerName ?? importer.buyerName,
        countryOfOrigin: dto.countryOfOrigin ?? selectedLoading?.countryOfOrigin ?? null,
        countryOfDestination: dto.countryOfDestination ?? selectedLanding?.countryOfDestination ?? null,
        descriptionOfGoods: dto.descriptionOfGoods,
        hsCode: dto.hsCode,
        termsOfDelivery: dto.termsOfDelivery,
        termsOfPayment: dto.termsOfPayment,
        currency: dto.currency,
        exporterName: dto.exporterName ?? null,
        exporterAddress: dto.exporterAddress ?? null,
        exporterContact: dto.exporterContact ?? null,
        exporterEmail: dto.exporterEmail ?? null,
        totalBoxes: totals.totalBoxes,
        totalNetWeight: new Decimal(totals.totalNetWeight),
        totalGrossWeight: dto.totalGrossWeight !== undefined ? new Decimal(dto.totalGrossWeight) : null,
        subTotal: new Decimal(totals.subTotal),
        roundOff: new Decimal(roundOff),
        total: new Decimal(totals.total),
        amountInWords: dto.amountInWords ?? null,
        notes: dto.notes ?? null,
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
    const importer = await prisma.importer.findFirst({
      where: { id: importerId, deletedAt: null },
      include: { landingLocations: true, loadingLocations: true },
    });

    if (!importer) {
      throw new AppError('Importer not found', 404, 'IMPORTER_NOT_FOUND');
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

    return prisma.$transaction(async (tx) => {
      if (dto.lineItems) {
        await tx.lineItem.deleteMany({ where: { invoiceId: id } });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          ...(dto.invoiceNumber !== undefined ? { invoiceNumber: dto.invoiceNumber } : {}),
          ...(dto.invoiceDate !== undefined ? { invoiceDate: new Date(dto.invoiceDate) } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.importerId !== undefined ? { importerId: dto.importerId } : {}),
          ...(dto.landingLocationId !== undefined ? { landingLocationId: dto.landingLocationId } : {}),
          ...(dto.loadingLocationId !== undefined ? { loadingLocationId: dto.loadingLocationId } : {}),
          ...(dto.exportersRef !== undefined ? { exportersRef: dto.exportersRef } : {}),
          ...(dto.otherReferences !== undefined ? { otherReferences: dto.otherReferences } : {}),
          ...(dto.awbNumber !== undefined ? { awbNumber: dto.awbNumber } : {}),
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
          ...(dto.totalGrossWeight !== undefined
            ? { totalGrossWeight: dto.totalGrossWeight !== null ? new Decimal(dto.totalGrossWeight) : null }
            : {}),
          ...(dto.amountInWords !== undefined ? { amountInWords: dto.amountInWords } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
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

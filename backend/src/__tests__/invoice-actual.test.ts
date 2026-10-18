import { prismaMock } from './setup';
import { actualNumber, invoiceService } from '../services/invoice.service';

const original = (over: Record<string, unknown> = {}) => ({
  id: 'inv1', invoiceNumber: 'SMP-DEMO-E', invoiceDate: new Date('2026-10-17'), importerId: 'imp1', currency: 'AED',
  importerName: 'Dubai Fresh', exporterName: 'Green Harvest', bankName: 'HDFC BANK', declaration: 'We declare', signImage: 'data:image/png;base64,AAAA',
  total: 8000, totalBoxes: 50, actualOfId: null, deletedAt: null, createdAt: new Date('2026-10-17'), updatedAt: new Date('2026-10-17'),
  lineItems: [
    { id: 'li1', invoiceId: 'inv1', descriptionOfGoods: 'Mixed produce', netWeightPerPackage: 10, numberOfBoxes: 50, ratePerKg: 16, totalNetWeight: 500, totalPerBox: 160, amount: 8000, marksAndNos: 'M1', containerNo: 'M1' },
  ],
  actuals: [],
  ...over,
});

describe('actualNumber', () => {
  it('puts ACTUAL in front of the invoice number', () => {
    expect(actualNumber('SMP-DEMO-E')).toBe('ACTUAL SMP-DEMO-E');
  });
});

describe('invoiceService.createActual', () => {
  it('copies every field and line item into "ACTUAL <number>", linked to the original', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(original() as never);
    prismaMock.invoice.findUnique.mockResolvedValue(null);
    prismaMock.invoice.create.mockResolvedValue({ id: 'inv2' } as never);

    await invoiceService.createActual('inv1');

    const { data } = prismaMock.invoice.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data['invoiceNumber']).toBe('ACTUAL SMP-DEMO-E');
    expect(data['actualOfId']).toBe('inv1');
    // everything the original holds comes across
    expect(data).toMatchObject({ importerId: 'imp1', currency: 'AED', importerName: 'Dubai Fresh', exporterName: 'Green Harvest', bankName: 'HDFC BANK', declaration: 'We declare', signImage: 'data:image/png;base64,AAAA', total: 8000, totalBoxes: 50 });
    // but not its identity, dates, or deleted mark
    for (const key of ['id', 'createdAt', 'updatedAt', 'deletedAt', 'actuals']) expect(data).not.toHaveProperty(key);
    // line items are copied as new rows
    expect(data['lineItems']).toEqual({ create: [{ descriptionOfGoods: 'Mixed produce', netWeightPerPackage: 10, numberOfBoxes: 50, ratePerKg: 16, totalNetWeight: 500, totalPerBox: 160, amount: 8000, marksAndNos: 'M1', containerNo: 'M1' }] });
  });

  it('only looks at invoices that are not deleted', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(original() as never);
    prismaMock.invoice.findUnique.mockResolvedValue(null);
    prismaMock.invoice.create.mockResolvedValue({ id: 'inv2' } as never);
    await invoiceService.createActual('inv1');
    expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'inv1', deletedAt: null } }));
  });

  it('404s for a missing invoice', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    await expect(invoiceService.createActual('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses to make an actual of an actual', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(original({ invoiceNumber: 'ACTUAL SMP-DEMO-E', actualOfId: 'inv0' }) as never);
    await expect(invoiceService.createActual('inv1')).rejects.toMatchObject({ code: 'ALREADY_ACTUAL' });
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('refuses a second actual for the same invoice', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(original({ actuals: [{ id: 'inv2' }] }) as never);
    await expect(invoiceService.createActual('inv1')).rejects.toMatchObject({ statusCode: 409, code: 'ACTUAL_EXISTS' });
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('explains when that name is already taken (for example by one in the Recycle Bin)', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(original() as never);
    prismaMock.invoice.findUnique.mockResolvedValue({ id: 'old' } as never);
    await expect(invoiceService.createActual('inv1')).rejects.toMatchObject({ code: 'ACTUAL_NUMBER_TAKEN' });
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });
});

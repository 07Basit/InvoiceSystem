import { prismaMock } from './setup';
import { counterpartNumber, invoiceService } from '../services/invoice.service';
import { buildInvoiceDocument, printedInvoiceNumber } from '../services/invoice-document';
import { createInvoiceSchema, listInvoicesQuerySchema } from 'shared';

const source = (over: Record<string, unknown> = {}) => ({
  id: 'inv1', invoiceNumber: 'SMP-101', invoiceKind: 'PARTY', invoiceDate: new Date('2026-10-17'), importerId: 'imp1', currency: 'CAD',
  importerName: 'KJ Fruits', total: 1000, totalBoxes: 10, actualOfId: null, counterpartOfId: null, printedNumber: null,
  deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
  lineItems: [{ id: 'li1', invoiceId: 'inv1', descriptionOfGoods: 'Mango', netWeightPerPackage: 10, numberOfBoxes: 10, ratePerKg: 10, totalNetWeight: 100, totalPerBox: 100, amount: 1000, marksAndNos: null, containerNo: null }],
  counterparts: [],
  ...over,
});

describe('counterpartNumber', () => {
  it('adds the kind in brackets', () => {
    expect(counterpartNumber('SMP-101', 'CUSTOM')).toBe('SMP-101 (Custom)');
    expect(counterpartNumber('SMP-101', 'PARTY')).toBe('SMP-101 (Party)');
  });
});

describe('invoiceService.createCounterpart', () => {
  it('makes a custom invoice from a party invoice: a full copy that points back and prints the same number', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(source() as never);
    prismaMock.invoice.findUnique.mockResolvedValue(null);
    prismaMock.invoice.create.mockResolvedValue({ id: 'inv2' } as never);
    await invoiceService.createCounterpart('inv1');
    const { data } = prismaMock.invoice.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data).toMatchObject({ invoiceNumber: 'SMP-101 (Custom)', invoiceKind: 'CUSTOM', counterpartOfId: 'inv1', printedNumber: 'SMP-101', importerId: 'imp1', currency: 'CAD', total: 1000 });
    for (const key of ['id', 'createdAt', 'updatedAt', 'deletedAt', 'counterparts']) expect(data).not.toHaveProperty(key);
    expect(data['lineItems']).toEqual({ create: [expect.objectContaining({ descriptionOfGoods: 'Mango', amount: 1000 })] });
  });

  it('makes a party invoice from a custom one', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(source({ invoiceNumber: 'SMP-9', invoiceKind: 'CUSTOM' }) as never);
    prismaMock.invoice.findUnique.mockResolvedValue(null);
    prismaMock.invoice.create.mockResolvedValue({ id: 'inv2' } as never);
    await invoiceService.createCounterpart('inv1');
    const { data } = prismaMock.invoice.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data).toMatchObject({ invoiceNumber: 'SMP-9 (Party)', invoiceKind: 'PARTY' });
  });

  it('refuses to make a party or custom invoice from an actual invoice', async () => {
    prismaMock.invoice.findFirst.mockResolvedValueOnce(source({ invoiceNumber: 'ACTUAL SMP-101', actualOfId: 'x', invoiceKind: 'PARTY' }) as never);
    await expect(invoiceService.createCounterpart('inv1')).rejects.toMatchObject({ statusCode: 400, code: 'ACTUAL_NO_COUNTERPART' });
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('keeps printing the original number when a copy is copied again', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(source({ invoiceNumber: 'SMP-101 (Custom)', printedNumber: 'SMP-101', counterpartOfId: null }) as never);
    prismaMock.invoice.findUnique.mockResolvedValue(null);
    prismaMock.invoice.create.mockResolvedValue({ id: 'inv2' } as never);
    await invoiceService.createCounterpart('inv1');
    const { data } = prismaMock.invoice.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data['printedNumber']).toBe('SMP-101');
  });

  it('only a party or custom invoice can make a partner', async () => {
    prismaMock.invoice.findFirst.mockResolvedValueOnce(source({ invoiceKind: 'NORMAL' }) as never);
    await expect(invoiceService.createCounterpart('inv1')).rejects.toMatchObject({ statusCode: 400, code: 'NOT_PARTY_OR_CUSTOM' });
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('allows only one partner, from either side', async () => {
    prismaMock.invoice.findFirst.mockResolvedValueOnce(source({ counterparts: [{ id: 'inv2' }] }) as never);
    await expect(invoiceService.createCounterpart('inv1')).rejects.toMatchObject({ statusCode: 409, code: 'COUNTERPART_EXISTS' });
    prismaMock.invoice.findFirst.mockResolvedValueOnce(source({ counterpartOfId: 'inv0' }) as never);
    await expect(invoiceService.createCounterpart('inv1')).rejects.toMatchObject({ statusCode: 409, code: 'COUNTERPART_EXISTS' });
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('404s for a missing invoice and refuses a number that is already taken', async () => {
    prismaMock.invoice.findFirst.mockResolvedValueOnce(null);
    await expect(invoiceService.createCounterpart('nope')).rejects.toMatchObject({ statusCode: 404 });
    prismaMock.invoice.findFirst.mockResolvedValueOnce(source() as never);
    prismaMock.invoice.findUnique.mockResolvedValue({ id: 'taken' } as never);
    await expect(invoiceService.createCounterpart('inv1')).rejects.toMatchObject({ statusCode: 409, code: 'COUNTERPART_NUMBER_TAKEN' });
  });
});

describe('creating and filtering', () => {
  it('a new invoice can be normal, party or custom, and the kind can be filtered', () => {
    for (const kind of ['NORMAL', 'PARTY', 'CUSTOM']) expect(createInvoiceSchema.shape.invoiceKind.parse(kind)).toBe(kind);
    expect(createInvoiceSchema.shape.invoiceKind.safeParse('OTHER').success).toBe(false);
    expect(listInvoicesQuerySchema.parse({ kind: 'custom' }).kind).toBe('custom');
    expect(listInvoicesQuerySchema.parse({ kind: 'normal' }).kind).toBe('normal');
    expect(listInvoicesQuerySchema.safeParse({ kind: 'x' }).success).toBe(false);
  });

  it('filters the list by kind', async () => {
    prismaMock.$transaction.mockResolvedValue([[], 0] as never);
    await invoiceService.list({ page: 1, limit: 20, order: 'desc', sort: 'createdAt', kind: 'custom' } as never);
    expect((prismaMock.invoice.findMany.mock.calls.at(-1)![0] as { where: Record<string, unknown> }).where).toMatchObject({ invoiceKind: 'CUSTOM' });
  });
});

describe('what a document prints', () => {
  const doc = (over: Record<string, unknown>) => ({ invoiceNumber: 'SMP-101 (Custom)', invoiceDate: new Date('2026-10-17'), currency: 'CAD', importer: { name: 'KJ' }, lineItems: [], totalBoxes: 0, totalNetWeight: 0, subTotal: 0, total: 0, ...over }) as never;

  it('uses the saved printed number of a copy, falling back to the actual link, then the own number', () => {
    expect(printedInvoiceNumber({ invoiceNumber: 'SMP-101 (Custom)', printedNumber: 'SMP-101' })).toBe('SMP-101');
    expect(printedInvoiceNumber({ invoiceNumber: 'ACTUAL SMP-2', actualOf: { invoiceNumber: 'SMP-2' } })).toBe('SMP-2');
    expect(printedInvoiceNumber({ invoiceNumber: 'SMP-3' })).toBe('SMP-3');
  });

  it('labels the document party or custom and prints the plain number', () => {
    const custom = buildInvoiceDocument(doc({ invoiceKind: 'CUSTOM', printedNumber: 'SMP-101' }));
    expect(custom.kindLabel).toBe('CUSTOM');
    expect(custom.invoiceNumber).toBe('SMP-101');
    expect(buildInvoiceDocument(doc({ invoiceKind: 'PARTY' })).kindLabel).toBe('PARTY');
    // a normal invoice has no party / custom label
    expect(buildInvoiceDocument(doc({ invoiceKind: 'NORMAL' })).kindLabel).toBe('');
    expect(buildInvoiceDocument(doc({ invoiceKind: null })).kindLabel).toBe('');
  });
});

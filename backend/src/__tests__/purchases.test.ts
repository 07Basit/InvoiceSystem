import * as XLSX from 'xlsx';
import { prismaMock } from './setup';
import { purchaseService, invoiceKey, productKey, sameProduct } from '../services/purchase.service';
import { currencyService } from '../services/currency.service';
import { supplierService } from '../services/supplier.service';
import { purchaseInvoiceSchema, supplierSchema, purchaseTemplateSchema, type PurchaseInvoiceDto } from 'shared';

const dto = (over: Partial<PurchaseInvoiceDto> = {}): PurchaseInvoiceDto => ({
  supplierId: 's1', invoiceNumber: 'MP/26/118', invoiceDate: '2026-10-10',
  lines: [{ productName: 'Amla', netWeight: 95, quantity: 19, rate: 14.75, rateBasis: 'KG', amount: 1401.25 }],
  subTotal: 1401.25, taxAmount: 70.06, freight: 300, otherCharges: 0, total: 1771.31, ...over,
});

const line = (over: Record<string, unknown> = {}) => ({ id: 'l1', productName: 'Amla', description: null, quantity: '19', netWeight: '95', unit: null, rate: '14.75', rateBasis: 'KG', amount: '1401.25', sortOrder: 0, ...over });
const invoice = (over: Record<string, unknown> = {}, lines = [line()]) => ({
  id: 'p1', supplierId: 's1', supplier: { id: 's1', name: 'Mapoose' }, invoiceNumber: 'MP/26/118', invoiceDate: new Date('2026-10-10T00:00:00Z'), purchaseDate: null, dueDate: null, currency: 'INR',
  subTotal: '1401.25', taxAmount: '70.06', freight: '300', otherCharges: '0', total: '1771.31', notes: null, sourceFileName: null, sourceHash: null,
  createdAt: new Date('2026-10-11T00:00:00Z'), updatedAt: new Date('2026-10-11T00:00:00Z'), deletedAt: null, lines, ...over,
});

jest.mock('../services/currency.service', () => ({ currencyService: { buildConverter: jest.fn() } }));

describe('purchase schemas', () => {
  it('accepts a complete invoice and fills in missing charges with zero', () => {
    const { taxAmount: _t, freight: _f, otherCharges: _o, ...bare } = dto();
    void _t; void _f; void _o;
    const parsed = purchaseInvoiceSchema.parse({ ...bare, subTotal: 1401.25, total: 1401.25 });
    expect([parsed.taxAmount, parsed.freight, parsed.otherCharges]).toEqual([0, 0, 0]);
    expect(purchaseInvoiceSchema.safeParse(dto()).success).toBe(true);
  });

  it('refuses figures that do not add up (beyond a rupee of rounding)', () => {
    const wrongSub = purchaseInvoiceSchema.safeParse(dto({ subTotal: 1500 }));
    expect(wrongSub.success).toBe(false);
    const wrongTotal = purchaseInvoiceSchema.safeParse(dto({ total: 2000 }));
    expect(wrongTotal.success).toBe(false);
    expect(purchaseInvoiceSchema.safeParse(dto({ total: 1771.9 })).success).toBe(true); // 59 paise of rounding
  });

  it('needs a supplier, a number, a real date and a product', () => {
    expect(purchaseInvoiceSchema.safeParse(dto({ supplierId: '' })).success).toBe(false);
    expect(purchaseInvoiceSchema.safeParse(dto({ invoiceNumber: '  ' })).success).toBe(false);
    expect(purchaseInvoiceSchema.safeParse(dto({ invoiceDate: '10/10/2026' })).success).toBe(false);
    expect(purchaseInvoiceSchema.safeParse(dto({ lines: [] })).success).toBe(false);
    expect(purchaseInvoiceSchema.safeParse(dto({ lines: [{ productName: 'Amla', rate: -1, rateBasis: 'KG', amount: 1 }] })).success).toBe(false);
  });

  it('checks suppliers and templates', () => {
    expect(supplierSchema.safeParse({ name: ' ' }).success).toBe(false);
    expect(supplierSchema.safeParse({ name: 'Sunil', email: 'nope' }).success).toBe(false);
    expect(supplierSchema.parse({ name: ' Sunil ' }).name).toBe('Sunil');
    expect(purchaseTemplateSchema.safeParse({ fields: { invoiceNumber: { cell: 'b2' } }, columns: { rate: 'Price' } }).success).toBe(true);
    expect(purchaseTemplateSchema.parse({ fields: { invoiceNumber: { cell: 'b2' } } }).fields?.invoiceNumber?.cell).toBe('B2');
    expect(purchaseTemplateSchema.safeParse({ fields: { invoiceNumber: { cell: 'not a cell' } } }).success).toBe(false);
  });
});

describe('keys used to compare names', () => {
  it('treats spacing, capitals and punctuation as the same', () => {
    expect(invoiceKey('MP/26/118')).toBe(invoiceKey(' mp 26-118 '));
    expect(productKey('  Amla  ')).toBe(productKey('AMLA'));
    expect(productKey('Drumstick  Leves')).toBe('drumstick leves');
  });
});

describe('supplierService', () => {
  it('does not take a second supplier with the same name', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 'x' } as never);
    await expect(supplierService.create({ name: 'mapoose' })).rejects.toMatchObject({ statusCode: 409, code: 'SUPPLIER_EXISTS' });
    expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith({ where: { deletedAt: null, name: { equals: 'mapoose', mode: 'insensitive' } }, select: { id: true } });
  });

  it('keeps a supplier that has purchase invoices, and deletes one that has none', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1' } as never);
    prismaMock.purchaseInvoice.count.mockResolvedValue(3);
    await expect(supplierService.remove('s1')).rejects.toMatchObject({ statusCode: 409, code: 'SUPPLIER_IN_USE' });
    prismaMock.purchaseInvoice.count.mockResolvedValue(0);
    prismaMock.supplier.update.mockResolvedValue({} as never);
    await supplierService.remove('s1');
    expect(prismaMock.supplier.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { deletedAt: expect.any(Date) } });
  });
});

describe('purchaseService: saving and duplicates', () => {
  beforeEach(() => { prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1' } as never); });

  it('saves the invoice with its lines in order', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([]);
    prismaMock.purchaseInvoice.create.mockResolvedValue(invoice() as never);
    const saved = await purchaseService.create(dto({ lines: [dto().lines[0]!, { productName: 'Banana', netWeight: 30, rate: 14.1, rateBasis: 'KG', amount: 423 }], subTotal: 1824.25, total: 2194.31 }));
    const args = prismaMock.purchaseInvoice.create.mock.calls[0]![0] as { data: { invoiceDate: Date; lines: { create: { productName: string; sortOrder: number }[] } } };
    expect(args.data.invoiceDate.toISOString()).toBe('2026-10-10T00:00:00.000Z');
    expect(args.data.lines.create.map((l) => [l.productName, l.sortOrder])).toEqual([['Amla', 0], ['Banana', 1]]);
    expect(saved).toMatchObject({ supplierName: 'Mapoose', invoiceDate: '2026-10-10', total: 1771.31 });
  });

  it('refuses the same invoice number from the same supplier, however it is written', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([{ id: 'old', invoiceNumber: 'mp 26 118', invoiceDate: new Date('2026-10-10T00:00:00Z'), total: '1771.31', supplierId: 's1', sourceHash: null, supplier: { name: 'Mapoose' } }] as never);
    await expect(purchaseService.create(dto())).rejects.toMatchObject({ statusCode: 409, code: 'PURCHASE_DUPLICATE' });
    expect(prismaMock.purchaseInvoice.create).not.toHaveBeenCalled();
  });

  it('refuses the very same file even under another number, and allows another supplier\'s same number', async () => {
    const hash = 'a'.repeat(64);
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([{ id: 'old', invoiceNumber: 'DIFFERENT', invoiceDate: new Date('2026-10-01T00:00:00Z'), total: '10', supplierId: 's1', sourceHash: hash, supplier: { name: 'Mapoose' } }] as never);
    await expect(purchaseService.create(dto({ sourceHash: hash }))).rejects.toMatchObject({ code: 'PURCHASE_DUPLICATE', message: expect.stringContaining('file was already added') });
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([{ id: 'other', invoiceNumber: 'MP/26/118', invoiceDate: new Date('2026-10-10T00:00:00Z'), total: '1', supplierId: 's2', sourceHash: null, supplier: { name: 'Sunil' } }] as never);
    prismaMock.purchaseInvoice.create.mockResolvedValue(invoice() as never);
    await expect(purchaseService.create(dto())).resolves.toBeDefined();
  });

  it('looks at saved invoices only, so a deleted one can be entered again, and not at itself when edited', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([]);
    await purchaseService.findDuplicates({ supplierId: 's1', invoiceNumber: 'A-1', exceptId: 'me' });
    expect(prismaMock.purchaseInvoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null, NOT: { id: 'me' }, OR: [{ supplierId: 's1' }] } }));
  });

  it('replaces the lines when an invoice is edited, and soft-deletes', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(invoice() as never);
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, invoice()] as never);
    await purchaseService.update('p1', dto());
    expect(prismaMock.purchaseLine.deleteMany).toHaveBeenCalledWith({ where: { purchaseInvoiceId: 'p1' } });
    prismaMock.purchaseInvoice.update.mockResolvedValue({} as never);
    await purchaseService.remove('p1');
    expect(prismaMock.purchaseInvoice.update).toHaveBeenLastCalledWith({ where: { id: 'p1' }, data: { deletedAt: expect.any(Date) } });
  });
});

describe('purchaseService: listing', () => {
  it('filters by supplier, dates and product, and shows dates and amounts as plain values', async () => {
    prismaMock.$transaction.mockResolvedValue([[invoice()], 1] as never);
    const result = await purchaseService.list({ page: 1, limit: 20, order: 'desc', sort: 'invoiceDate', supplierId: 's1', invoiceFrom: '2026-10-01', invoiceTo: '2026-10-31', product: 'amla' } as never);
    expect(prismaMock.purchaseInvoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        deletedAt: null, supplierId: 's1',
        invoiceDate: { gte: new Date('2026-10-01T00:00:00Z'), lte: new Date('2026-10-31T00:00:00Z') },
        lines: { some: { productName: { contains: 'amla', mode: 'insensitive' } } },
      }),
    }));
    expect(result.meta).toMatchObject({ total: 1, totalPages: 1 });
    expect((result.data[0] as { invoiceDate: string; total: number }).invoiceDate).toBe('2026-10-10');
  });
});

describe('purchaseService: reports', () => {
  const rows = () => [
    invoice({ id: 'a', total: '1771.31' }),
    invoice({ id: 'b', supplierId: 's2', supplier: { id: 's2', name: 'Sunil' }, invoiceNumber: 'SF-1', purchaseDate: new Date('2026-10-26T00:00:00Z'), subTotal: '2900', taxAmount: '145', freight: '120', otherCharges: '10', total: '3175' },
      [line({ id: 'l2', productName: 'amla', netWeight: '200', quantity: '20', rate: '14.50', amount: '2900' })]),
  ];

  it('totals each supplier and everything together, with freight, GST and other charges', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue(rows() as never);
    const report = await purchaseService.report({ from: '2026-10-01', to: '2026-10-31' });
    expect(prismaMock.purchaseInvoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ purchaseDate: { gte: new Date('2026-10-01T00:00:00Z'), lte: new Date('2026-10-31T00:00:00Z') } }, { purchaseDate: null, invoiceDate: { gte: new Date('2026-10-01T00:00:00Z'), lte: new Date('2026-10-31T00:00:00Z') } }] }),
    }));
    expect(report.totals).toEqual({ count: 2, subTotal: 4301.25, taxAmount: 215.06, freight: 420, otherCharges: 10, total: 4946.31 });
    expect(report.bySupplier.map((s) => [s.supplierName, s.count, s.total])).toEqual([['Mapoose', 1, 1771.31], ['Sunil', 1, 3175]]);
  });

  it('adds up each product across suppliers (Amla and amla are one), with quantity, weight and rates', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue(rows() as never);
    const { byProduct } = await purchaseService.report({});
    expect(byProduct).toHaveLength(1);
    expect(byProduct[0]).toMatchObject({ product: 'Amla', lines: 2, quantity: 39, netWeight: 295, amount: 4301.25, minRate: 14.5, maxRate: 14.75 });
    expect(byProduct[0]!.averageRate).toBeCloseTo(4301.25 / 295, 3);
  });

  it('counts only the chosen product when one is asked for', async () => {
    const two = [invoice({ total: '1771.31' }, [line(), line({ id: 'l9', productName: 'Banana', amount: '423', netWeight: '30', rate: '14.10' })])];
    prismaMock.purchaseInvoice.findMany.mockResolvedValue(two as never);
    const report = await purchaseService.report({ product: 'banana' });
    expect(report.totals.total).toBe(423);
    expect(report.byProduct.map((p) => p.product)).toEqual(['Banana']);
  });
});

describe('purchaseService: price history', () => {
  const dated = (id: string, date: string, rate: string, supplier = 'Mapoose') =>
    invoice({ id, invoiceDate: new Date(`${date}T00:00:00Z`), supplier: { id: supplier, name: supplier }, supplierId: supplier, invoiceNumber: `N-${id}` }, [line({ rate, productName: 'Amla' })]);

  it('lists each purchase of the product by date and compares the latest rate with the one before', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([dated('b', '2026-10-26', '46'), dated('a', '2026-10-10', '40')] as never);
    const history = await purchaseService.priceHistory({ product: 'amla' });
    expect(history.points.map((p) => [p.date, p.rate])).toEqual([['2026-10-10', 40], ['2026-10-26', 46]]);
    expect(history.summary).toEqual({ latest: 46, latestDate: '2026-10-26', previous: 40, previousDate: '2026-10-10', changePercent: 15, lowest: 40, highest: 46, average: 43 });
  });

  it('has no summary for a product that was never bought, and no change for a single purchase', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([]);
    expect(await purchaseService.priceHistory({ product: 'mango' })).toEqual({ product: 'mango', points: [], summary: null });
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([dated('a', '2026-10-10', '40')] as never);
    expect((await purchaseService.priceHistory({ product: 'amla' })).summary).toMatchObject({ previous: null, changePercent: null });
  });

  it('gives each product a latest rate, its move against the same supplier, the cheapest supplier and a small trend', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([
      dated('c', '2026-10-26', '46'), dated('a', '2026-10-10', '40'), dated('s', '2026-10-20', '42', 'Sunil'),
    ] as never);
    const [amla] = await purchaseService.overview({});
    expect(amla).toMatchObject({
      product: 'Amla', purchases: 3, suppliers: 2,
      latest: { rate: 46, date: '2026-10-26', supplierName: 'Mapoose' },
      previousRate: 40, changePercent: 15,
      cheapest: { supplierName: 'Sunil', rate: 42 },
      lowest: 40, highest: 46, average: 42.67, sale: null,
    });
    expect(amla!.series.map((p) => p.rate)).toEqual([40, 42, 46]);
  });

  it('has no move for a first purchase, and no cheapest supplier with only one', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([dated('a', '2026-10-10', '40')] as never);
    const [amla] = await purchaseService.overview({});
    expect(amla).toMatchObject({ previousRate: null, changePercent: null, cheapest: null });
  });

  it('compares a supplier only with their own earlier purchase', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([dated('a', '2026-10-10', '30', 'Sunil'), dated('b', '2026-10-26', '90')] as never);
    const [amla] = await purchaseService.overview({});
    expect(amla).toMatchObject({ latest: { supplierName: 'Mapoose' }, previousRate: null, changePercent: null });
  });

  it('shows what the connected invoice sold the product for and the purchase it is compared with', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([invoice({ id: 'p1', invoiceId: 'inv1' }, [line({ productName: 'Amla', rate: '86' })])] as never);
    prismaMock.invoice.findMany.mockResolvedValue([{ id: 'inv1', invoiceNumber: 'ACTUAL 12', currency: 'INR', invoiceDate: new Date('2026-10-20T00:00:00Z'), manualRate: null, manualRateBase: null, lineItems: [{ descriptionOfGoods: 'Amla', ratePerKg: '120', totalNetWeight: '10' }] }] as never);
    const [amla] = await purchaseService.overview({});
    expect(amla!.sale).toEqual({ invoiceId: 'inv1', invoiceNumber: 'ACTUAL 12', currency: 'INR', rate: 120, rateInr: 120, buyRate: 86, date: '2026-10-10' });
  });

  it('lists product names once, whatever the capital letters, and the latest rate of each', async () => {
    (prismaMock.purchaseLine.groupBy as unknown as jest.Mock).mockResolvedValue([{ productName: 'Amla', _count: { _all: 2 } }, { productName: 'amla ', _count: { _all: 1 } }, { productName: 'Banana', _count: { _all: 1 } }] as never);
    expect(await purchaseService.productNames()).toEqual([{ product: 'Amla', lines: 3 }, { product: 'Banana', lines: 1 }]);
    const withInvoice = (id: string, date: string, rate: string) => ({ ...line({ id, rate }), purchaseInvoice: { invoiceDate: new Date(`${date}T00:00:00Z`), purchaseDate: null, createdAt: new Date(`${date}T00:00:00Z`), supplier: { name: 'Mapoose' } } });
    prismaMock.purchaseLine.findMany.mockResolvedValue([withInvoice('x', '2026-10-26', '46'), withInvoice('y', '2026-10-10', '40')] as never);
    expect(await purchaseService.lastRates()).toEqual([{ product: 'Amla', rate: 46, rateBasis: 'KG', date: '2026-10-26', supplierName: 'Mapoose' }]);
  });
});

describe('purchaseService: connected actual invoice', () => {
  beforeEach(() => { prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1' } as never); prismaMock.purchaseInvoice.findMany.mockResolvedValue([]); });

  it('only accepts an actual invoice that still exists', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    await expect(purchaseService.create(dto({ invoiceId: 'inv1' }))).rejects.toMatchObject({ statusCode: 400, code: 'PURCHASE_INVOICE_NOT_ACTUAL' });
    expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'inv1', deletedAt: null, actualOfId: { not: null } } }));
    expect(prismaMock.purchaseInvoice.create).not.toHaveBeenCalled();
  });

  it('saves the connection, and none when no invoice is chosen', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: 'inv1' } as never);
    prismaMock.purchaseInvoice.create.mockResolvedValue(invoice({ invoiceId: 'inv1', invoice: { id: 'inv1', invoiceNumber: 'ACTUAL 12', invoiceDate: new Date('2026-10-20T00:00:00Z'), currency: 'CAD', importerName: 'Ziyan' } }) as never);
    const saved = await purchaseService.create(dto({ invoiceId: 'inv1' }));
    expect((prismaMock.purchaseInvoice.create.mock.calls[0]![0] as { data: { invoiceId: string | null } }).data.invoiceId).toBe('inv1');
    expect(saved.invoice).toEqual({ id: 'inv1', invoiceNumber: 'ACTUAL 12', invoiceDate: '2026-10-20', currency: 'CAD', importerName: 'Ziyan' });
    await purchaseService.create(dto());
    expect((prismaMock.purchaseInvoice.create.mock.calls[1]![0] as { data: { invoiceId: string | null } }).data.invoiceId).toBeNull();
  });

  it('matches product names loosely', () => {
    expect(sameProduct('BABY KARELA', 'Baby Karela')).toBe(true);
    expect(sameProduct('AMLA', 'Amla (500g PP)')).toBe(true);
    expect(sameProduct('Small Onion', 'Onion')).toBe(false);
    expect(sameProduct('Amla', 'Amlakar')).toBe(false);
  });

  const connected = (rate = '2.50') => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([invoice({ id: 'p1', invoiceId: 'inv1' }, [line({ productName: 'Amla', rate: '86' })])] as never);
    prismaMock.invoice.findMany.mockResolvedValue([{ id: 'inv1', invoiceNumber: 'ACTUAL 12', currency: 'CAD', invoiceDate: new Date('2026-10-20T00:00:00Z'), manualRate: null, manualRateBase: null,
      lineItems: [{ descriptionOfGoods: 'AMLA (500G PP)', ratePerKg: rate, totalNetWeight: '60' }, { descriptionOfGoods: 'Okra', ratePerKg: '9', totalNetWeight: '10' }] }] as never);
  };

  it('shows what the connected invoice charged for the product, in its currency and in rupees', async () => {
    connected();
    // CAD -> USD 0.72, INR -> USD 0.012, so 1 CAD is 60 rupees
    (currencyService.buildConverter as jest.Mock).mockResolvedValue({ convertDetailed: (inv: { currency: string }) => ({ rate: inv.currency === 'CAD' ? 0.72 : 0.012 }) });
    const history = await purchaseService.priceHistory({ product: 'Amla' });
    expect(history.points[0]!.sale).toEqual({ invoiceId: 'inv1', invoiceNumber: 'ACTUAL 12', currency: 'CAD', rate: 2.5, rateInr: 150, fxRate: 60 });
  });

  it('still shows the sale in its own currency when no exchange rate is known', async () => {
    connected();
    (currencyService.buildConverter as jest.Mock).mockRejectedValue(new Error('offline'));
    const sale = (await purchaseService.priceHistory({ product: 'Amla' })).points[0]!.sale;
    expect(sale).toMatchObject({ currency: 'CAD', rate: 2.5, rateInr: null, fxRate: null });
  });

  it('has no sale for a purchase that is not connected, or when the invoice has no such product', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([invoice({ id: 'p1' }, [line({ productName: 'Amla', rate: '86' })])] as never);
    expect((await purchaseService.priceHistory({ product: 'Amla' })).points[0]!.sale).toBeNull();
    connected();
    prismaMock.invoice.findMany.mockResolvedValue([{ id: 'inv1', invoiceNumber: 'ACTUAL 12', currency: 'INR', invoiceDate: new Date('2026-10-20T00:00:00Z'), manualRate: null, manualRateBase: null, lineItems: [{ descriptionOfGoods: 'Okra', ratePerKg: '9', totalNetWeight: '10' }] }] as never);
    expect((await purchaseService.priceHistory({ product: 'Amla' })).points[0]!.sale).toBeNull();
  });
});

describe('purchaseService: reading an uploaded invoice', () => {
  const upload = () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['MAPOOSE TRADERS'], ['Invoice No:', 'MP/26/118'], ['Date:', '10/10/2026'], [],
      ['Particulars', 'Qty', 'Net Wt (Kgs)', 'Rate / Kg', 'Amount'], ['Amla', 19, 95, 14.75, 1401.25],
      ['Sub Total', null, null, null, 1401.25], ['Grand Total', null, null, null, 1401.25],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'S');
    return { buffer: XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer, originalname: 'mapoose.xlsx' };
  };

  it('recognises the supplier, reads the invoice and flags one that was already added', async () => {
    prismaMock.supplier.findMany.mockResolvedValue([{ id: 's1', name: 'Mapoose', importTemplate: null }, { id: 's2', name: 'Sunil', importTemplate: null }] as never);
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([{ id: 'old', invoiceNumber: 'MP/26/118', invoiceDate: new Date('2026-10-10T00:00:00Z'), total: '1401.25', supplierId: 's1', sourceHash: null, supplier: { name: 'Mapoose' } }] as never);
    const parsed = await purchaseService.preview(upload(), {});
    expect(parsed).toMatchObject({ supplierId: 's1', invoiceNumber: 'MP/26/118', invoiceDate: '2026-10-10', total: 1401.25 });
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.duplicates).toEqual([expect.objectContaining({ id: 'old', reason: 'invoice-number' })]);
    expect(prismaMock.purchaseInvoice.create).not.toHaveBeenCalled(); // reading never saves
  });

  it('uses the chosen supplier\'s template, and refuses an unknown supplier or a bad template', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([]);
    prismaMock.supplier.findMany.mockResolvedValue([{ id: 's1', name: 'Mapoose', importTemplate: { fields: { invoiceNumber: { cell: 'B2' } } } }] as never);
    expect((await purchaseService.preview(upload(), { supplierId: 's1' })).found['invoiceNumber']).toBe('B2');
    await expect(purchaseService.preview(upload(), { supplierId: 'nope' })).rejects.toMatchObject({ code: 'SUPPLIER_NOT_FOUND' });
    await expect(purchaseService.preview(upload(), { template: { fields: { invoiceNumber: { cell: '??' } } } })).rejects.toMatchObject({ code: 'PURCHASE_BAD_TEMPLATE' });
  });
});

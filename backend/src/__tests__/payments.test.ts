import { PDFDocument } from 'pdf-lib';
import ExcelJS from 'exceljs';
import { prismaMock } from './setup';
import { paymentService, summaryOf } from '../services/payment.service';
import { statementService } from '../services/statement.service';
import { renderStatementPdf } from '../services/statement-pdf';
import { renderStatementExcel } from '../services/statement-excel';
import { paymentSchema, type Statement } from 'shared';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('payment summary', () => {
  it('says unpaid, part paid, paid or overpaid', () => {
    expect(summaryOf(1000, 0)).toEqual({ total: 1000, paid: 0, balance: 1000, status: 'unpaid' });
    expect(summaryOf(1000, 400)).toMatchObject({ balance: 600, status: 'partial' });
    expect(summaryOf(1000, 1000)).toMatchObject({ balance: 0, status: 'paid' });
    expect(summaryOf(1000.004, 1000)).toMatchObject({ status: 'paid' });
    expect(summaryOf(1000, 1200)).toMatchObject({ balance: -200, status: 'overpaid' });
  });
});

describe('payment schema', () => {
  it('needs a date and an amount above zero', () => {
    expect(paymentSchema.safeParse({ paidOn: '2026-10-20', amount: 250.5 }).success).toBe(true);
    expect(paymentSchema.safeParse({ paidOn: '2026-10-20', amount: 0 }).success).toBe(false);
    expect(paymentSchema.safeParse({ paidOn: '20/10/2026', amount: 10 }).success).toBe(false);
    expect(paymentSchema.safeParse({ paidOn: '2026-10-20', amount: -5 }).success).toBe(false);
  });
});

describe('paymentService', () => {
  const actual = { id: 'inv1', total: '1000', currency: 'CAD', actualOfId: 'orig1' };
  const payment = (over: Record<string, unknown> = {}) => ({ id: 'pay1', invoiceId: 'inv1', paidOn: d('2026-10-20'), amount: '400', method: 'Bank transfer', reference: 'UTR123', notes: null, createdAt: new Date('2026-10-20T10:00:00Z'), ...over });

  it('only takes payments on an actual invoice', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ ...actual, actualOfId: null } as never);
    await expect(paymentService.create('inv1', { paidOn: '2026-10-20', amount: 100 })).rejects.toMatchObject({ statusCode: 400, code: 'PAYMENT_NOT_ACTUAL' });
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    await expect(paymentService.forInvoice('nope')).rejects.toMatchObject({ statusCode: 404, code: 'INVOICE_NOT_FOUND' });
  });

  it('records a payment and returns the invoice with its payments and balance', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(actual as never);
    prismaMock.payment.create.mockResolvedValue(payment() as never);
    prismaMock.payment.findMany.mockResolvedValue([payment()] as never);
    const result = await paymentService.create('inv1', { paidOn: '2026-10-20', amount: 400, method: ' Bank transfer ', reference: 'UTR123', notes: '  ' });
    const data = (prismaMock.payment.create.mock.calls[0]![0] as { data: { paidOn: Date; method: string | null; notes: string | null } }).data;
    expect(data.paidOn.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect([data.method, data.notes]).toEqual(['Bank transfer', null]);
    expect(result.summary).toEqual({ total: 1000, paid: 400, balance: 600, status: 'partial' });
    expect(result.payments[0]).toMatchObject({ paidOn: '2026-10-20', amount: 400, reference: 'UTR123' });
    expect(result.currency).toBe('CAD');
  });

  it('changes and deletes a payment, answering with the invoice\'s new position', async () => {
    prismaMock.payment.findUnique.mockResolvedValue({ invoiceId: 'inv1' } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(actual as never);
    prismaMock.payment.findMany.mockResolvedValue([] as never);
    expect((await paymentService.remove('pay1')).summary.status).toBe('unpaid');
    expect(prismaMock.payment.delete).toHaveBeenCalledWith({ where: { id: 'pay1' } });
    await paymentService.update('pay1', { paidOn: '2026-10-22', amount: 500 });
    expect(prismaMock.payment.update).toHaveBeenCalled();
    prismaMock.payment.findUnique.mockResolvedValue(null);
    await expect(paymentService.remove('gone')).rejects.toMatchObject({ code: 'PAYMENT_NOT_FOUND' });
  });

  it('lists the methods used so far, most used first, treating different capitals as one', async () => {
    (prismaMock.payment.groupBy as unknown as jest.Mock).mockResolvedValue([
      { method: 'Cash', _count: { _all: 1 } }, { method: 'cheque', _count: { _all: 1 } }, { method: 'Cheque', _count: { _all: 4 } }, { method: 'Wire (HSBC)', _count: { _all: 3 } }, { method: '  ', _count: { _all: 9 } },
    ]);
    expect(await paymentService.methods()).toEqual(['Cheque', 'Wire (HSBC)', 'Cash']);
  });

  it('gives a summary to actual invoices only', async () => {
    (prismaMock.payment.groupBy as unknown as jest.Mock).mockResolvedValue([{ invoiceId: 'a1', _sum: { amount: '300' } }]);
    const map = await paymentService.summaries([{ id: 'a1', total: '1000', actualOfId: 'o1' }, { id: 'a2', total: '50', actualOfId: 'o2' }, { id: 'o3', total: '70', actualOfId: null }]);
    expect(map.get('a1')).toMatchObject({ paid: 300, balance: 700, status: 'partial' });
    expect(map.get('a2')).toMatchObject({ paid: 0, status: 'unpaid' });
    expect(map.has('o3')).toBe(false);
  });
});

describe('statementService', () => {
  const invoice = (id: string, number: string, date: string, currency: string, total: string, payments: Record<string, unknown>[] = []) => ({
    id, invoiceNumber: `ACTUAL ${number}`, printedNumber: number, actualOf: { invoiceNumber: number }, invoiceDate: d(date), currency, total, createdAt: d(date), payments,
  });
  const pay = (id: string, date: string, amount: string, method: string | null = null, reference: string | null = null) => ({ id, paidOn: d(date), amount, method, reference, createdAt: d(date) });

  beforeEach(() => {
    prismaMock.importer.findUnique.mockResolvedValue({ id: 'imp1', name: 'KJ Fruits', address: '123 Street\nToronto', contact: null, email: 'a@b.com' } as never);
    prismaMock.invoice.findMany.mockResolvedValue([
      invoice('a', 'INV-1', '2026-09-10', 'CAD', '1000', [pay('p1', '2026-09-20', '400', 'Bank transfer', 'UTR1')]),
      invoice('b', 'INV-2', '2026-10-05', 'CAD', '500'),
      invoice('c', 'INV-3', '2026-10-07', 'USD', '200'),
    ] as never);
  });

  it('lists invoices and payments in date order with a running balance, per currency', async () => {
    const statement = await statementService.build('imp1', {});
    expect(statement.importer).toMatchObject({ name: 'KJ Fruits', email: 'a@b.com' });
    const [cad, usd] = statement.sections;
    expect(cad).toMatchObject({ currency: 'CAD', opening: 0, invoiced: 1500, received: 400, closing: 1100 });
    expect(cad!.rows.map((r) => [r.kind, r.reference, r.debit, r.credit, r.balance])).toEqual([['invoice', 'INV-1', 1000, 0, 1000], ['payment', 'INV-1', 0, 400, 600], ['invoice', 'INV-2', 500, 0, 1100]]);
    expect(cad!.rows[1]!.description).toBe('Payment received · Bank transfer · Ref UTR1');
    expect(usd).toMatchObject({ currency: 'USD', closing: 200 });
  });

  it('rolls what came before the period into the opening balance', async () => {
    const statement = await statementService.build('imp1', { from: '2026-10-01' });
    const cad = statement.sections.find((s) => s.currency === 'CAD')!;
    expect(cad.opening).toBe(600);
    expect(cad.rows.map((r) => r.reference)).toEqual(['INV-2']);
    expect(cad.closing).toBe(1100);
    // the older invoice is still listed because it still owes
    expect(cad.invoices.map((i) => [i.number, i.balance, i.status])).toEqual([['INV-1', 600, 'partial'], ['INV-2', 500, 'unpaid']]);
  });

  it('stops at the end date, and leaves out payments made after it', async () => {
    const statement = await statementService.build('imp1', { to: '2026-09-15' });
    const cad = statement.sections.find((s) => s.currency === 'CAD')!;
    expect(cad.rows.map((r) => r.kind)).toEqual(['invoice']);
    expect(cad.closing).toBe(1000);
    expect(cad.invoices).toEqual([expect.objectContaining({ number: 'INV-1', paid: 0, balance: 1000, status: 'unpaid' })]);
    expect(statement.sections.find((s) => s.currency === 'USD')).toBeUndefined();
  });

  it('refuses an importer that does not exist', async () => {
    prismaMock.importer.findUnique.mockResolvedValue(null);
    await expect(statementService.build('x', {})).rejects.toMatchObject({ statusCode: 404, code: 'IMPORTER_NOT_FOUND' });
  });
});

describe('statement files', () => {
  const statement = (rows: number): Statement => ({
    importer: { id: 'i', name: 'KJ Fruits', address: '123 Street', contact: null, email: null },
    from: '2026-10-01', to: '2026-10-31', generatedOn: '2026-11-16',
    sections: [{
      currency: 'CAD', opening: 600, invoiced: 500 * rows, received: 0, closing: 600 + 500 * rows,
      rows: Array.from({ length: rows }, (_, i) => ({ date: '2026-10-05', kind: 'invoice' as const, reference: `INV-${i}`, description: 'Invoice', debit: 500, credit: 0, balance: 600 + 500 * (i + 1) })),
      invoices: [{ invoiceId: 'a', number: 'INV-0', date: '2026-10-05', total: 500, paid: 0, balance: 500, status: 'unpaid' as const }],
    }],
  });

  it('makes a PDF, adding pages when there are many rows', async () => {
    const small = await renderStatementPdf(statement(3));
    expect(Buffer.from(small.slice(0, 5)).toString()).toBe('%PDF-');
    const big = await PDFDocument.load(await renderStatementPdf(statement(120)));
    expect(big.getPageCount()).toBeGreaterThan(2);
    expect((await PDFDocument.load(small)).getPageCount()).toBe(1);
  });

  it('makes a PDF even when there is nothing to show', async () => {
    const bytes = await renderStatementPdf({ ...statement(0), sections: [] });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it('makes a workbook with a sheet for each currency', async () => {
    const buffer = await renderStatementExcel(statement(3));
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as never);
    expect(book.worksheets.map((s) => s.name)).toEqual(['Statement CAD']);
    const sheet = book.getWorksheet('Statement CAD')!;
    const text = sheet.getSheetValues().flat().filter((v) => typeof v === 'string').join('|');
    expect(text).toContain('KJ Fruits');
    expect(text).toContain('INV-2');
  });
});

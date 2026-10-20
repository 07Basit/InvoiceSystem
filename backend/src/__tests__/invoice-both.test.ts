import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { createInvoiceSchema } from 'shared';
import { prismaMock } from './setup';
import { invoiceService } from '../services/invoice.service';
import { recycleService } from '../services/recycle.service';
import { buildInvoiceDocument, type InvoiceSource } from '../services/invoice-document';
import { renderInvoicePdf } from '../services/invoice-pdf';
import { renderInvoiceExcel } from '../services/invoice-excel';
import { zipInvoices } from '../services/invoice-zip';

const line = { descriptionOfGoods: 'Mango', netWeightPerPackage: 10, numberOfBoxes: 10, ratePerKg: 2 };
const body = { invoiceDate: '2026-10-17T00:00:00.000Z', currency: 'CAD', lineItems: [line], preCarriageBy: 'TRUCK', placeOfReceiptByPreCarrier: 'N/A', vesselFlightNo: 'By Air', descriptionOfGoods: 'FRUITS', hsCode: '709', termsOfDelivery: 'CNF', termsOfPayment: 'ADVANCE' };
const importer = { id: 'imp1', name: 'KJ', address: null, contact: null, email: null, buyerName: null, isActive: true, deletedAt: null, landingLocations: [], loadingLocations: [] };

describe('invoiceService.create for a BOTH invoice', () => {
  beforeEach(() => {
    prismaMock.importer.findFirst.mockResolvedValue(importer as never);
    prismaMock.invoice.count.mockResolvedValue(0);
  });

  it('saves the party page as the invoice and the custom page as a hidden companion that points back at it', async () => {
    prismaMock.invoice.create.mockResolvedValueOnce({ id: 'main' } as never).mockResolvedValueOnce({ id: 'comp' } as never);
    const result = await invoiceService.create({ ...body, importerId: 'imp1', invoiceNumber: 'SMP-1', invoiceKind: 'BOTH', customVersion: { ...body, currency: 'USD', lineItems: [{ ...line, ratePerKg: 3 }] } } as never);

    expect(result).toMatchObject({ id: 'main' });
    const [mainCall, companionCall] = prismaMock.invoice.create.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data);
    expect(mainCall).toMatchObject({ invoiceNumber: 'SMP-1', invoiceKind: 'BOTH', currency: 'CAD' });
    expect(mainCall).not.toHaveProperty('isCompanion');
    expect(companionCall).toMatchObject({ invoiceNumber: 'SMP-1 (Custom)', invoiceKind: 'CUSTOM', counterpartOfId: 'main', isCompanion: true, printedNumber: 'SMP-1', currency: 'USD', importerId: 'imp1' });
  });

  it('needs the content of the custom page', async () => {
    await expect(invoiceService.create({ ...body, importerId: 'imp1', invoiceNumber: 'SMP-1', invoiceKind: 'BOTH' } as never)).rejects.toMatchObject({ statusCode: 400, code: 'CUSTOM_VERSION_REQUIRED' });
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('refuses when the custom page number is already used', async () => {
    prismaMock.invoice.count.mockResolvedValue(1);
    await expect(invoiceService.create({ ...body, importerId: 'imp1', invoiceNumber: 'SMP-1', invoiceKind: 'BOTH', customVersion: body } as never)).rejects.toMatchObject({ statusCode: 409, code: 'COUNTERPART_NUMBER_TAKEN' });
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('removes the party invoice again if the custom page cannot be saved', async () => {
    prismaMock.invoice.create.mockResolvedValueOnce({ id: 'main' } as never).mockRejectedValueOnce(new Error('boom'));
    prismaMock.$transaction.mockResolvedValue([] as never);
    await expect(invoiceService.create({ ...body, importerId: 'imp1', invoiceNumber: 'SMP-1', invoiceKind: 'BOTH', customVersion: body } as never)).rejects.toThrow('boom');
    expect(prismaMock.lineItem.deleteMany).toHaveBeenCalledWith({ where: { invoiceId: 'main' } });
    expect(prismaMock.invoice.delete).toHaveBeenCalledWith({ where: { id: 'main' } });
  });

  it('does nothing special for a normal, party or custom invoice', async () => {
    prismaMock.invoice.create.mockResolvedValue({ id: 'one' } as never);
    await invoiceService.create({ ...body, importerId: 'imp1', invoiceNumber: 'SMP-2', invoiceKind: 'PARTY' } as never);
    expect(prismaMock.invoice.create).toHaveBeenCalledTimes(1);
  });
});

describe('createInvoiceSchema', () => {
  it('accepts BOTH with a custom version, and the custom version has no number, importer or type of its own', () => {
    const parsed = createInvoiceSchema.parse({ ...body, importerId: 'cmvdb3sqn0000rh84q1ww3c0c', invoiceNumber: 'A', invoiceKind: 'BOTH', customVersion: { ...body, invoiceNumber: 'ignored' } });
    expect(parsed.invoiceKind).toBe('BOTH');
    expect(parsed.customVersion).toBeDefined();
    expect(parsed.customVersion).not.toHaveProperty('invoiceNumber');
  });
});

describe('invoiceService.softDelete and the Recycle Bin', () => {
  it('deletes the hidden custom page with its party invoice', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: 'main', lineItems: [], counterparts: [] } as never);
    await invoiceService.softDelete('main');
    expect(prismaMock.invoice.updateMany).toHaveBeenCalledWith({ where: { counterpartOfId: 'main', isCompanion: true, deletedAt: null }, data: { deletedAt: expect.any(Date) } });
    expect(prismaMock.invoice.update).toHaveBeenCalledWith({ where: { id: 'main' }, data: { deletedAt: expect.any(Date) } });
  });

  it('never shows the hidden page in the Recycle Bin, and restores and removes it with its party invoice', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([] as never);
    prismaMock.importer.findMany.mockResolvedValue([] as never);
    await recycleService.listDeleted();
    expect((prismaMock.invoice.findMany.mock.calls[0]![0] as { where: Record<string, unknown> }).where).toMatchObject({ isCompanion: false });

    prismaMock.invoice.findFirst.mockResolvedValue({ id: 'main' } as never);
    await recycleService.restore('invoice', 'main');
    expect(prismaMock.invoice.updateMany).toHaveBeenCalledWith({ where: { counterpartOfId: 'main', isCompanion: true }, data: { deletedAt: null } });

    prismaMock.invoice.findMany.mockResolvedValue([{ id: 'comp' }] as never);
    prismaMock.$transaction.mockResolvedValue([] as never);
    await recycleService.permanentDelete('invoice', 'main');
    expect(prismaMock.invoice.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['comp'] } } });
  });
});

describe('invoiceService.update for a BOTH invoice', () => {
  it('keeps the custom page number in step when the party number changes', async () => {
    const spy = jest.spyOn(invoiceService, 'updateRow').mockResolvedValue({ id: 'main' } as never);
    prismaMock.invoice.findFirst.mockResolvedValue({ id: 'comp' } as never);
    await invoiceService.update('main', { invoiceNumber: 'SMP-9', customVersion: { ...body, currency: 'USD' } } as never);
    expect(spy).toHaveBeenNthCalledWith(1, 'main', { invoiceNumber: 'SMP-9' });
    expect(prismaMock.invoice.update).toHaveBeenCalledWith({ where: { id: 'comp' }, data: { invoiceNumber: 'SMP-9 (Custom)', printedNumber: 'SMP-9' } });
    expect(spy).toHaveBeenNthCalledWith(2, 'comp', expect.objectContaining({ currency: 'USD' }));
    spy.mockRestore();
  });

  it('only updates the invoice itself when there is no hidden page', async () => {
    const spy = jest.spyOn(invoiceService, 'updateRow').mockResolvedValue({ id: 'one' } as never);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    await invoiceService.update('one', { currency: 'EUR' } as never);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

const source = (over: Partial<InvoiceSource> = {}): InvoiceSource => ({
  invoiceNumber: 'SMP-1', invoiceDate: new Date('2026-10-17T00:00:00.000Z'), currency: 'CAD',
  exporterName: 'Green Harvest', exporterAddress: null, exporterContact: null, exporterEmail: null,
  importerName: 'KJ', importerAddress: null, importerContact: null, importerEmail: null, importer: { name: 'KJ' },
  buyerName: null, exportersRef: null, otherReferences: null, awbNumber: null, buyersOrder: null,
  preCarriageBy: null, placeOfReceiptByPreCarrier: null, vesselFlightNo: null, portOfLoading: null, portOfDischarge: null, finalDestination: null,
  countryOfOrigin: null, countryOfDestination: null, descriptionOfGoods: 'FRUITS', hsCode: null, termsOfDelivery: null, termsOfPayment: null,
  bankName: null, bankAccountNumber: null, bankIfscCode: null, bankSwiftCode: null, declaration: null, signName: null, signImage: null,
  totalBoxes: 10, totalNetWeight: 100, totalGrossWeight: null, subTotal: 200, total: 200, amountInWords: null,
  lineItems: [{ marksAndNos: null, containerNo: null, descriptionOfGoods: 'Mango', netWeightPerPackage: 10, numberOfBoxes: 10, totalNetWeight: 100, ratePerKg: 2, totalPerBox: 20, amount: 200 }],
  ...over,
});
const party = () => buildInvoiceDocument(source({ invoiceKind: 'BOTH' }));
const custom = () => buildInvoiceDocument(source({ invoiceNumber: 'SMP-1 (Custom)', printedNumber: 'SMP-1', invoiceKind: 'CUSTOM', total: 300 }));

describe('documents of a BOTH invoice', () => {
  it('labels the party page PARTY and the custom page CUSTOM, both under the same printed number', () => {
    expect(party().kindLabel).toBe('PARTY');
    expect(custom().kindLabel).toBe('CUSTOM');
    expect(custom().invoiceNumber).toBe('SMP-1');
  });

  it('puts both pages in one PDF', async () => {
    const one = await PDFDocument.load(await renderInvoicePdf(party()));
    const both = await PDFDocument.load(await renderInvoicePdf([party(), custom()]));
    expect(both.getPageCount()).toBeGreaterThanOrEqual(one.getPageCount() * 2);
  });

  it('puts a Party sheet and a Custom sheet in one workbook', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await renderInvoiceExcel([party(), custom()])) as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Party SMP-1', 'Custom SMP-1']);
    expect(wb.getWorksheet('Party SMP-1')!.getCell('F1').value).toBe('INVOICE · PARTY');
    expect(wb.getWorksheet('Custom SMP-1')!.getCell('F1').value).toBe('INVOICE · CUSTOM');
  });

  it('keeps a single sheet named Invoice for a normal invoice', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await renderInvoiceExcel(buildInvoiceDocument(source()))) as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Invoice']);
  });

  it('keeps sheet names legal and short, and different from each other', async () => {
    const number = 'A/B:C*D?E[F]'.repeat(5);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await renderInvoiceExcel([
      buildInvoiceDocument(source({ invoiceNumber: number, invoiceKind: 'BOTH' })),
      buildInvoiceDocument(source({ invoiceNumber: number, invoiceKind: 'CUSTOM' })),
    ])) as never);
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toHaveLength(2);
    names.forEach((n) => { expect(n.length).toBeLessThanOrEqual(31); expect(n).not.toMatch(/[\\/?*[\]:]/); });
    expect(names[0]).toMatch(/^Party /);
    expect(names[1]).toMatch(/^Custom /);
  });

  it('a ZIP holds one PDF and one Excel file per BOTH invoice, with both pages inside', async () => {
    const zip = await JSZip.loadAsync(await zipInvoices([{ invoice: source({ invoiceKind: 'BOTH' }), companion: source({ invoiceNumber: 'SMP-1 (Custom)', printedNumber: 'SMP-1', invoiceKind: 'CUSTOM' }) }], ['pdf', 'excel']));
    expect(Object.keys(zip.files).sort()).toEqual(['invoice-SMP-1.pdf', 'invoice-SMP-1.xlsx']);
    const pdf = await PDFDocument.load(await zip.file('invoice-SMP-1.pdf')!.async('nodebuffer'));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});

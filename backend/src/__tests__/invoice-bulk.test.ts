import JSZip from 'jszip';
import { zipInvoicesSchema, bulkInvoiceIdsSchema, MAX_ZIP_INVOICES } from 'shared';
import { prismaMock } from './setup';
import { invoiceService } from '../services/invoice.service';
import { zipInvoices } from '../services/invoice-zip';
import type { InvoiceSource } from '../services/invoice-document';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function invoice(number: string): InvoiceSource {
  return {
    invoiceNumber: number, invoiceDate: new Date('2026-10-17T00:00:00.000Z'), currency: 'CAD',
    exporterName: 'Green Harvest', exporterAddress: '19 Dock Rd', exporterContact: null, exporterEmail: null,
    importerName: 'ABC Foods', importerAddress: null, importerContact: null, importerEmail: null, importer: { name: 'ABC Foods' },
    buyerName: null, exportersRef: null, otherReferences: null, awbNumber: null, buyersOrder: null,
    preCarriageBy: null, placeOfReceiptByPreCarrier: null, vesselFlightNo: null, portOfLoading: 'bom', portOfDischarge: 'yyz', finalDestination: 'yyz',
    countryOfOrigin: 'india', countryOfDestination: 'canada', descriptionOfGoods: 'FRUITS', hsCode: '709', termsOfDelivery: 'CNF YYZ', termsOfPayment: 'ADVANCE',
    bankName: null, bankAccountNumber: null, bankIfscCode: null, bankSwiftCode: null, declaration: null, signName: null, signImage: PNG,
    totalBoxes: 10, totalNetWeight: 100, totalGrossWeight: null, subTotal: 250, total: 250, amountInWords: null,
    lineItems: [{ marksAndNos: 'M1', containerNo: 'M1', descriptionOfGoods: 'Mango', netWeightPerPackage: 10, numberOfBoxes: 10, totalNetWeight: 100, ratePerKg: 2.5, totalPerBox: 25, amount: 250 }],
  };
}

describe('zipInvoices', () => {
  it('holds a PDF and an Excel file for every invoice', async () => {
    const buffer = await zipInvoices([invoice('INV-1'), invoice('INV-2')], ['pdf', 'excel']);
    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files).sort()).toEqual(['invoice-INV-1.pdf', 'invoice-INV-1.xlsx', 'invoice-INV-2.pdf', 'invoice-INV-2.xlsx']);
    const pdf = await zip.file('invoice-INV-1.pdf')!.async('nodebuffer');
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('holds only the chosen format', async () => {
    const zip = await JSZip.loadAsync(await zipInvoices([invoice('INV-1')], ['excel']));
    expect(Object.keys(zip.files)).toEqual(['invoice-INV-1.xlsx']);
  });

  it('keeps file names unique when two invoice numbers clean up to the same name', async () => {
    const zip = await JSZip.loadAsync(await zipInvoices([invoice('A/1'), invoice('A#1')], ['pdf']));
    expect(Object.keys(zip.files).sort()).toEqual(['invoice-A_1-2.pdf', 'invoice-A_1.pdf']);
  });
});

describe('bulk schemas', () => {
  it('needs at least one invoice', () => {
    expect(bulkInvoiceIdsSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(bulkInvoiceIdsSchema.safeParse({ ids: ['a'] }).success).toBe(true);
  });

  it('defaults a ZIP to PDF and caps its size', () => {
    expect(zipInvoicesSchema.parse({ ids: ['a'] }).formats).toEqual(['pdf']);
    expect(zipInvoicesSchema.safeParse({ ids: ['a'], formats: [] }).success).toBe(false);
    expect(zipInvoicesSchema.safeParse({ ids: Array.from({ length: MAX_ZIP_INVOICES + 1 }, (_, i) => `i${i}`) }).success).toBe(false);
  });
});

describe('invoiceService.listIds', () => {
  it('returns the ids matching the filters, flagging when there are more than the cap', async () => {
    prismaMock.invoice.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }] as never);
    const result = await invoiceService.listIds({ currency: 'CAD' } as never, 2);
    expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ deletedAt: null, currency: 'CAD' }), take: 3 }));
    expect(result).toEqual({ ids: ['a', 'b'], truncated: true });
  });
});

describe('deleteInvoices (bulk delete)', () => {
  it('deletes what it can and reports the rest', async () => {
    const { deleteInvoices } = await import('../controllers/invoice.controller');
    const { events } = await import('../services/notification.events');
    jest.spyOn(events, 'invoiceDeleted').mockResolvedValue(undefined as never);
    jest.spyOn(invoiceService, 'softDelete').mockImplementation(async (id: string) => {
      if (id === 'missing') throw new Error('Invoice not found');
      return {} as never;
    });
    const json = jest.fn();
    await deleteInvoices({ body: { ids: ['a', 'missing', 'a', 'b'] }, user: { id: 'u1' } } as never, { json } as never, jest.fn());
    await new Promise((r) => setImmediate(r));
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: { deleted: ['a', 'b'], failed: [{ id: 'missing', message: 'Invoice not found' }] } }));
  });
});

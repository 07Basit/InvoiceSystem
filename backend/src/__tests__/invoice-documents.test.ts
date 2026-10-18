import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { DEFAULT_DECLARATION } from 'shared';
import { amountInWords, buildInvoiceDocument, formatCountry, formatNumber, numberToWords, safeFileName, type InvoiceSource } from '../services/invoice-document';
import { renderInvoicePdf } from '../services/invoice-pdf';
import { renderInvoiceExcel } from '../services/invoice-excel';

// a 1x1 transparent PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const line = (n: number, over: Record<string, unknown> = {}) => ({
  marksAndNos: `MARK-${n}`, containerNo: `MARK-${n}`, descriptionOfGoods: `Fresh mangoes grade A ${n}`,
  netWeightPerPackage: 9, numberOfBoxes: 72, totalNetWeight: 648, ratePerKg: 2.5, totalPerBox: 22.5, amount: 1620, ...over,
});

function invoice(over: Partial<InvoiceSource> = {}, lines = 1): InvoiceSource {
  return {
    invoiceNumber: 'INV/2026 #1', invoiceDate: new Date('2026-10-17T00:00:00.000Z'), currency: 'CAD',
    exporterName: 'Green Harvest Exports', exporterAddress: '19 Dock Rd, Navi Mumbai', exporterContact: '+91 90000 10000', exporterEmail: 'exports@gh.in',
    importerName: 'ABC Foods', importerAddress: '1 Main St', importerContact: '+1 555 0100', importerEmail: 'abc@example.com', importer: { name: 'ABC Foods (current)' },
    buyerName: 'ABC Buying Desk', exportersRef: 'REF-9', otherReferences: 'PO-77', awbNumber: 'AWB123', buyersOrder: 'BO-5 / 12 Oct 2026',
    preCarriageBy: 'TRUCK', placeOfReceiptByPreCarrier: 'N/A', vesselFlightNo: 'By Air', portOfLoading: 'bom', portOfDischarge: 'yyz', finalDestination: 'yyz',
    countryOfOrigin: 'india', countryOfDestination: 'united states', descriptionOfGoods: 'FRUITS & VEGETABLES', hsCode: '709', termsOfDelivery: 'CNF YYZ', termsOfPayment: 'ADVANCE',
    bankName: 'HDFC BANK', bankAccountNumber: '5036834342323', bankIfscCode: 'HDFC45300321', bankSwiftCode: 'HDFCINDFBXXX',
    declaration: null, signName: 'Proprietor sign', signImage: PNG,
    totalBoxes: 72 * lines, totalNetWeight: 648 * lines, totalGrossWeight: 700, subTotal: 1620 * lines, total: 1620 * lines, amountInWords: null,
    lineItems: Array.from({ length: lines }, (_, i) => line(i + 1)),
    ...over,
  };
}

describe('buildInvoiceDocument', () => {
  const doc = buildInvoiceDocument(invoice());

  it('carries every field of the invoice, grouped in sections', () => {
    expect(doc.references.map((f) => f.label)).toEqual(['Invoice No.', 'Invoice Date', "Exporter's Ref.", "Buyer's Order No. & Date", 'Other Reference(s)', 'AWB No.', 'Currency']);
    expect(doc.shipping.map((f) => f.label)).toEqual(['Pre-Carriage by', 'Place of Receipt by Pre-Carrier', 'Vessel / Flight No.', 'Port of Loading', 'Port of Discharge', 'Final Destination', 'Country of Origin', 'Country of Destination']);
    expect(doc.goods.map((f) => f.label)).toEqual(['Description of Goods', 'HS Code', 'Terms of Delivery', 'Terms of Payment']);
    expect(doc.bank.map((f) => f.label)).toEqual(['Bank Name', 'Account Number', 'IFSC Code', 'SWIFT Code']);
  });

  it("uses the invoice's own copy of the importer, and shows saved values", () => {
    expect(doc.importer.name).toBe('ABC Foods');
    expect(doc.references.find((f) => f.label === "Buyer's Order No. & Date")?.value).toBe('BO-5 / 12 Oct 2026');
    expect(doc.invoiceDate).toBe('17 Oct 2026');
  });

  it('formats ports and countries and leaves empty values blank', () => {
    const value = (label: string) => doc.shipping.find((f) => f.label === label)?.value;
    expect(value('Port of Loading')).toBe('BOM');
    expect(value('Country of Destination')).toBe('United States');
    const empty = buildInvoiceDocument(invoice({ awbNumber: null, hsCode: '  ' }));
    expect(empty.references.find((f) => f.label === 'AWB No.')?.value).toBe('');
    expect(empty.goods.find((f) => f.label === 'HS Code')?.value).toBe('');
    expect(buildInvoiceDocument(invoice({ buyerName: null })).buyer).toBe('');
  });

  it('falls back to the standard declaration and to computed amount in words', () => {
    expect(doc.declaration).toBe(DEFAULT_DECLARATION);
    expect(doc.amountInWords).toBe('One Thousand Six Hundred Twenty');
  });

  it('decodes the seal & sign image and makes a safe file name', () => {
    expect(doc.sign?.mime).toBe('image/png');
    expect(doc.sign?.bytes.length).toBeGreaterThan(10);
    expect(doc.fileName).toBe('INV_2026_1');
    expect(buildInvoiceDocument(invoice({ signImage: 'not-an-image' })).sign).toBeNull();
  });
});

describe('helpers', () => {
  it('spells amounts like the invoice form', () => {
    expect(numberToWords(0)).toBe('Zero');
    expect(numberToWords(1234567)).toBe('One Million Two Hundred Thirty Four Thousand Five Hundred Sixty Seven');
    expect(amountInWords(10.5, 'USD')).toBe('Ten and Fifty Cents');
    expect(amountInWords(3.07, 'INR')).toBe('Three and Seven Paise');
  });
  it('formats numbers, countries and file names', () => {
    expect(formatNumber(12345.6)).toBe('12,345.60');
    expect(formatCountry('trinidad and tobago')).toBe('Trinidad and Tobago');
    expect(safeFileName('  ../x y ')).toBe('x_y');
    expect(safeFileName('///')).toBe('invoice');
  });
});

describe('renderInvoicePdf', () => {
  it('produces a valid one-page A4 PDF for a normal invoice', async () => {
    const bytes = await renderInvoicePdf(buildInvoiceDocument(invoice()));
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe('Invoice INV/2026 #1');
    const { width, height } = pdf.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it('flows long invoices onto more pages instead of cutting rows off', async () => {
    const pdf = await PDFDocument.load(await renderInvoicePdf(buildInvoiceDocument(invoice({}, 60))));
    expect(pdf.getPageCount()).toBeGreaterThan(2);
  });

  it('never fails on characters the built-in font cannot draw', async () => {
    const doc = buildInvoiceDocument(invoice({ importerName: 'ภาษาไทย Ltd ₹ 日本', buyerName: 'Ünïcode “quotes” — ok', declaration: 'Line one\nLine two ✓' }));
    await expect(renderInvoicePdf(doc)).resolves.toBeInstanceOf(Uint8Array);
  });

  it('still renders when the signature image is damaged or missing', async () => {
    const broken = buildInvoiceDocument(invoice({ signImage: 'data:image/png;base64,AAAA' }));
    await expect(renderInvoicePdf(broken)).resolves.toBeInstanceOf(Uint8Array);
    await expect(renderInvoicePdf(buildInvoiceDocument(invoice({ signImage: null })))).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe('renderInvoiceExcel', () => {
  async function load(src: InvoiceSource) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await renderInvoiceExcel(buildInvoiceDocument(src))) as unknown as ExcelJS.Buffer);
    return wb.getWorksheet('Invoice')!;
  }
  const allText = (ws: ExcelJS.Worksheet) => {
    const out: string[] = [];
    ws.eachRow((row) => row.eachCell((cell) => {
      const v = cell.value as unknown;
      out.push(v && typeof v === 'object' && 'richText' in (v as object) ? (v as { richText: { text: string }[] }).richText.map((r) => r.text).join('') : String(v));
    }));
    return out;
  };

  it('contains every section and field of the invoice', async () => {
    const ws = await load(invoice());
    const text = allText(ws);
    for (const expected of ['INVOICE', 'EXPORTER', 'IMPORTER / CONSIGNEE', 'Green Harvest Exports', 'ABC Foods', 'ABC Buying Desk', 'INVOICE REFERENCES', "Buyer's Order No. & Date", 'BO-5 / 12 Oct 2026', 'AWB123', 'SHIPPING AND ROUTE', 'BOM', 'United States', 'GOODS AND TERMS', 'FRUITS & VEGETABLES', 'CNF YYZ', 'PRODUCT DETAILS', 'Fresh mangoes grade A 1', 'BANK DETAILS', 'HDFC45300321', 'DECLARATION', DEFAULT_DECLARATION, 'Authorised Signatory']) {
      expect(text.some((t) => t.includes(expected))).toBe(true);
    }
  });

  it('writes numbers as numbers with formats, one row per product', async () => {
    const ws = await load(invoice({}, 3));
    const header = ws.getRow(1);
    let headerRow = 0;
    ws.eachRow((row, n) => { if (row.getCell(1).value === 'No' && row.getCell(2).value === 'Marks & Container No.') headerRow = n; });
    expect(headerRow).toBeGreaterThan(1);
    expect(header).toBeDefined();
    const first = ws.getRow(headerRow + 1);
    expect(first.getCell(4).value).toBe(9);
    expect(first.getCell(5).value).toBe(72);
    expect(first.getCell(9).value).toBe(1620);
    expect(first.getCell(9).numFmt).toBe('#,##0.00');
    expect(ws.getRow(headerRow + 3).getCell(1).value).toBe(3);
  });

  it('embeds the seal & sign image', async () => {
    expect((await load(invoice())).getImages()).toHaveLength(1);
    expect((await load(invoice({ signImage: null }))).getImages()).toHaveLength(0);
  });

  it('is set up to print on A4, one page wide', async () => {
    const ws = await load(invoice());
    expect(ws.pageSetup.paperSize).toBe(9);
    expect(ws.pageSetup.fitToWidth).toBe(1);
  });
});

describe('blank fields stay blank in both documents', () => {
  const blank = invoice({ awbNumber: null, hsCode: null, buyerName: null, amountInWords: '' });
  it('writes no dash placeholder into the workbook', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await renderInvoiceExcel(buildInvoiceDocument(blank))) as unknown as ExcelJS.Buffer);
    let dashes = 0;
    wb.getWorksheet('Invoice')!.eachRow((row) => row.eachCell((cell) => { if (String(cell.value).trim() === '—') dashes++; }));
    expect(dashes).toBe(0);
  });
  it('still renders the PDF', async () => {
    await expect(renderInvoicePdf(buildInvoiceDocument(blank))).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe('actual invoices print the number of the original invoice', () => {
  it('shows the original number inside the document, but keeps its own file name', () => {
    const doc = buildInvoiceDocument(invoice({ invoiceNumber: 'ACTUAL SMP-1', actualOf: { invoiceNumber: 'SMP-1' } }));
    expect(doc.invoiceNumber).toBe('SMP-1');
    expect(doc.references.find((f) => f.label === 'Invoice No.')?.value).toBe('SMP-1');
    expect(doc.fileName).toBe('ACTUAL_SMP-1');
  });

  it('leaves a normal invoice as it is', () => {
    const doc = buildInvoiceDocument(invoice({ invoiceNumber: 'SMP-2', actualOf: null }));
    expect(doc.invoiceNumber).toBe('SMP-2');
    expect(doc.fileName).toBe('SMP-2');
  });

  it('puts the original number in the Excel and PDF titles', async () => {
    const doc = buildInvoiceDocument(invoice({ invoiceNumber: 'ACTUAL SMP-1', actualOf: { invoiceNumber: 'SMP-1' } }));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await renderInvoiceExcel(doc)) as never);
    expect(wb.title).toBe('Invoice SMP-1');
    const pdf = await PDFDocument.load(await renderInvoicePdf(doc));
    expect(pdf.getTitle()).toBe('Invoice SMP-1');
  });
});

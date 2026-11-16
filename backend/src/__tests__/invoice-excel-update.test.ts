import ExcelJS from 'exceljs';
import { prismaMock } from './setup';
import { buildInvoiceDocument, type InvoiceSource } from '../services/invoice-document';
import { INFO_SHEET, LINE_ID_HEADER, renderInvoiceExcel } from '../services/invoice-excel';
import { readInvoiceExcel } from '../services/invoice-excel-reader';
import { invoiceExcelUpdateService } from '../services/invoice-excel-update.service';
import { invoiceService } from '../services/invoice.service';

const UPDATED = new Date('2026-10-20T10:00:00.000Z');
const lines = [
  { id: 'l1', marksAndNos: 'CONT-01', containerNo: 'CONT-01', descriptionOfGoods: 'Alphonso Mango', netWeightPerPackage: 10, numberOfBoxes: 100, totalNetWeight: 1000, ratePerKg: 1, totalPerBox: 10, amount: 1000 },
  { id: 'l2', marksAndNos: 'CONT-02', containerNo: 'CONT-02', descriptionOfGoods: 'Kesar Mango', netWeightPerPackage: 10, numberOfBoxes: 100, totalNetWeight: 1000, ratePerKg: 0.75, totalPerBox: 7.5, amount: 750 },
  { id: 'l3', marksAndNos: 'CONT-03 / X', containerNo: 'CONT-3B', descriptionOfGoods: 'Pomegranate', netWeightPerPackage: 10, numberOfBoxes: 50, totalNetWeight: 500, ratePerKg: 0.5, totalPerBox: 5, amount: 250 },
];

/** The invoice as the service loads it (Prisma returns decimals as objects; numbers do the same job here). */
const stored = (over: Record<string, unknown> = {}) => ({
  id: 'inv1', invoiceNumber: 'SAMPLE-3', invoiceKind: 'NORMAL', actualOfId: null, updatedAt: UPDATED, currency: 'CAD', roundOff: 0,
  totalBoxes: 250, totalNetWeight: 2500, subTotal: 2000, total: 2000, totalGrossWeight: null, lineItems: lines, ...over,
});

const source = (): InvoiceSource => ({
  id: 'inv1', updatedAt: UPDATED, invoiceNumber: 'SAMPLE-3', invoiceDate: new Date('2026-10-18T00:00:00.000Z'), currency: 'CAD',
  exporterName: 'Blue Ocean Exports', exporterAddress: null, exporterContact: null, exporterEmail: null,
  importerName: 'KJ Fruits', importerAddress: null, importerContact: null, importerEmail: null, importer: { name: 'KJ Fruits' },
  buyerName: null, exportersRef: null, otherReferences: null, awbNumber: null, buyersOrder: null, preCarriageBy: null, placeOfReceiptByPreCarrier: null, vesselFlightNo: null,
  portOfLoading: 'BOM', portOfDischarge: 'YYZ', finalDestination: 'YYZ', countryOfOrigin: 'India', countryOfDestination: 'Canada', descriptionOfGoods: 'FRUITS', hsCode: '709',
  termsOfDelivery: null, termsOfPayment: null, bankName: null, bankAccountNumber: null, bankIfscCode: null, bankSwiftCode: null, declaration: null, signName: null, signImage: null,
  totalBoxes: 250, totalNetWeight: 2500, totalGrossWeight: null, subTotal: 2000, total: 2000, amountInWords: null, lineItems: lines,
});

/** The file as the app writes it. */
const download = () => renderInvoiceExcel(buildInvoiceDocument(source()));

/** Opens the downloaded file, lets a test edit it like a person would in Excel, and saves it again. */
async function edited(change: (sheet: ExcelJS.Worksheet, first: number) => void, base?: Buffer): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load((base ?? (await download())) as never);
  const sheet = book.getWorksheet('Invoice')!;
  let header = 0;
  sheet.eachRow((row, n) => { if (row.getCell(10).value === LINE_ID_HEADER) header = n; });
  change(sheet, header + 1);
  return Buffer.from(await book.xlsx.writeBuffer());
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(invoiceService, 'getById').mockResolvedValue(stored() as never);
  prismaMock.invoice.findFirst.mockResolvedValue(null);
});

describe('the downloaded invoice Excel', () => {
  it('says which invoice and version it is, in a hidden sheet, and keeps each line\'s id in a hidden column', async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await download()) as never);
    expect(book.getWorksheet(INFO_SHEET)!.state).toBe('veryHidden');
    expect(book.getWorksheet(INFO_SHEET)!.getCell('B2').value).toBe('inv1');
    expect(book.getWorksheet(INFO_SHEET)!.getCell('B3').value).toBe(UPDATED.toISOString());
    expect(book.getWorksheet('Invoice')!.getColumn(10).hidden).toBe(true);
  });

  it('reads back exactly what was written', async () => {
    const read = readInvoiceExcel(await download());
    expect(read.meta).toEqual({ invoiceId: 'inv1', version: UPDATED.toISOString(), both: false, companionId: null });
    expect(read.rows.map((r) => [r.id, r.description, r.nettPerPackage, r.boxes, r.rate])).toEqual([
      ['l1', 'Alphonso Mango', 10, 100, 1], ['l2', 'Kesar Mango', 10, 100, 0.75], ['l3', 'Pomegranate', 10, 50, 0.5],
    ]);
  });

  it('is not an Excel file, or has no table', async () => {
    expect(() => readInvoiceExcel(Buffer.from('hello'))).toThrow(/not an Excel file/);
    const book = new ExcelJS.Workbook();
    book.addWorksheet('Sheet1').addRow(['nothing', 'here']);
    expect(() => readInvoiceExcel(Buffer.from(book.xlsx.writeBuffer() as never))).toThrow();
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    expect(() => readInvoiceExcel(buffer)).toThrow(/table of product lines was not found/);
  });
});

describe('previewing an edited file', () => {
  const run = (buffer: Buffer) => invoiceExcelUpdateService.preview('inv1', { buffer, originalname: 'invoice.xlsx' });

  it('finds nothing to change in a file that was not edited', async () => {
    const p = await run(await download());
    expect(p.counts).toEqual({ added: 0, changed: 0, unchanged: 3, removed: 0 });
    expect(p.canApply).toBe(false);
    expect(p.fileIsOlder).toBe(false);
    expect(p.totals.after).toEqual(p.totals.before);
  });

  it('shows a changed value, a deleted row and an added row, with the new totals', async () => {
    const buffer = await edited((sheet, first) => {
      sheet.getRow(first).getCell(5).value = 120; // boxes of the first line
      sheet.getRow(first + 1).getCell(7).value = 0.8; // rate of the second line
      sheet.spliceRows(first + 2, 1); // delete the third line
      sheet.insertRow(first + 2, [3, 'NEW-1', 'Banana', 10, 20, 200, 0.25, 2.5, 50]); // add one
    });
    const p = await run(buffer);
    expect(p.counts).toEqual({ added: 1, changed: 2, unchanged: 0, removed: 1 });
    expect(p.lines.map((l) => [l.status, l.input.descriptionOfGoods])).toEqual([['changed', 'Alphonso Mango'], ['changed', 'Kesar Mango'], ['added', 'Banana']]);
    expect(p.lines[0]!.changes).toEqual([{ field: 'numberOfBoxes', label: 'Boxes', before: '100', after: '120' }]);
    expect(p.lines[1]!.changes).toEqual([{ field: 'ratePerKg', label: 'Rate / kg', before: '0.75', after: '0.8' }]);
    expect(p.removed).toEqual([{ id: 'l3', descriptionOfGoods: 'Pomegranate', numberOfBoxes: 50, amount: 250 }]);
    // 120 boxes x 10 kg x 1 = 1200, 100 x 10 x 0.8 = 800, 20 x 10 x 0.25 = 50
    expect(p.lines.map((l) => l.amount)).toEqual([1200, 800, 50]);
    expect(p.totals.after).toEqual({ boxes: 240, netWeight: 2400, subTotal: 2050, total: 2050 });
    expect(p.canApply).toBe(true);
  });

  it('keeps the marks and container of a line whose marks were not touched, and splits ones that were', async () => {
    const buffer = await edited((sheet, first) => {
      sheet.getRow(first + 1).getCell(2).value = 'A-1 / B-2';
    });
    const p = await run(buffer);
    expect(p.lines[2]!.input).toMatchObject({ marksAndNos: 'CONT-03 / X', containerNo: 'CONT-3B', id: 'l3' });
    expect(p.lines[1]!.input).toMatchObject({ marksAndNos: 'A-1', containerNo: 'B-2' });
  });

  it('flags a row that cannot be used, and points out an amount that does not match', async () => {
    const buffer = await edited((sheet, first) => {
      sheet.getRow(first).getCell(5).value = 0; // no boxes
      sheet.getRow(first + 1).getCell(9).value = 9999; // an amount typed over
    });
    const p = await run(buffer);
    expect(p.lines[0]!.problems).toEqual(['Boxes must be a whole number, 1 or more']);
    expect(p.canApply).toBe(false);
    expect(p.warnings.join(' ')).toMatch(/amount typed in Excel \(9999\.00\) is not boxes × weight × rate \(750\.00\)/);
  });

  it('matches rows by description when the hidden ids are gone, and a copied row counts as new', async () => {
    const noIds = await edited((sheet) => { sheet.getColumn(10).values = []; });
    expect((await run(noIds)).counts).toEqual({ added: 0, changed: 0, unchanged: 3, removed: 0 });
    const copied = await edited((sheet, first) => { sheet.insertRow(first + 1, [2, 'CONT-01', 'Alphonso Mango', 10, 5, 50, 1, 10, 50, 'l1']); });
    const p = await run(copied);
    expect(p.counts.added).toBe(1);
    expect(p.lines.filter((l) => l.id === 'l1')).toHaveLength(1);
  });

  it('warns when the invoice changed after the file was downloaded', async () => {
    jest.spyOn(invoiceService, 'getById').mockResolvedValue(stored({ updatedAt: new Date('2026-10-25T00:00:00.000Z') }) as never);
    const p = await run(await download());
    expect(p.fileIsOlder).toBe(true);
    expect(p.warnings[0]).toMatch(/changed in the app after you downloaded/);
  });

  it('refuses a file from another invoice, and the hidden Custom page on its own', async () => {
    jest.spyOn(invoiceService, 'getById').mockResolvedValue(stored({ id: 'other' }) as never);
    await expect(invoiceExcelUpdateService.preview('other', { buffer: await download(), originalname: 'x.xlsx' })).rejects.toMatchObject({ code: 'EXCEL_WRONG_INVOICE' });
    // the hidden Custom page of a Party + Custom invoice is updated through its Party invoice, never on its own
    jest.spyOn(invoiceService, 'getById').mockResolvedValue(stored({ isCompanion: true }) as never);
    await expect(run(await download())).rejects.toMatchObject({ code: 'EXCEL_UPDATE_NOT_SUPPORTED' });
  });

  it('blocks an update that would make the nett weight more than the gross weight', async () => {
    jest.spyOn(invoiceService, 'getById').mockResolvedValue(stored({ totalGrossWeight: 2500 }) as never);
    const p = await run(await edited((sheet, first) => { sheet.getRow(first).getCell(5).value = 200; }));
    expect(p.blockers[0]).toMatch(/nett weight .* more than the total gross weight/);
    expect(p.canApply).toBe(false);
  });

  it('tells an actual invoice what the update does to its balance', async () => {
    jest.spyOn(invoiceService, 'getById').mockResolvedValue(stored({ actualOfId: 'orig' }) as never);
    (prismaMock.payment.aggregate as unknown as jest.Mock).mockResolvedValue({ _sum: { amount: '500' } });
    const p = await run(await edited((sheet, first) => { sheet.getRow(first).getCell(5).value = 120; }));
    expect(p.payments).toEqual({ paid: 500, balanceBefore: 1500, balanceAfter: 1700 });
  });
});

describe('applying and undoing', () => {
  const dto = (over: Record<string, unknown> = {}) => ({
    lines: [
      { id: 'l1', marksAndNos: 'CONT-01', containerNo: 'CONT-01', descriptionOfGoods: 'Alphonso Mango', netWeightPerPackage: 10, numberOfBoxes: 120, ratePerKg: 1 },
      { descriptionOfGoods: 'Banana', netWeightPerPackage: 10, numberOfBoxes: 20, ratePerKg: 0.25 },
    ],
    invoiceVersion: UPDATED.toISOString(), fileName: 'invoice.xlsx', ...over,
  });

  it('replaces the lines, keeps the old ones for undo and counts what changed', async () => {
    const update = jest.spyOn(invoiceService, 'updateRow').mockResolvedValue({ updatedAt: new Date('2026-10-21T00:00:00.000Z') } as never);
    prismaMock.invoiceExcelUpdate.create.mockResolvedValue({ id: 'u1', fileName: 'invoice.xlsx', createdAt: new Date('2026-10-21T00:00:00.000Z') } as never);
    const record = await invoiceExcelUpdateService.apply('inv1', dto() as never);
    const sent = update.mock.calls[0]![1] as { lineItems: { id?: string; descriptionOfGoods: string }[]; amountInWords: string };
    expect(sent.lineItems.map((l) => [l.descriptionOfGoods, l.id])).toEqual([['Alphonso Mango', undefined], ['Banana', undefined]]);
    expect(sent.amountInWords).toBe('One Thousand Two Hundred Fifty'); // 1200 + 50
    const saved = (prismaMock.invoiceExcelUpdate.create.mock.calls[0]![0] as unknown as { data: { before: { lines: { descriptionOfGoods: string }[] }; afterVersion: string; added: number; removed: number; changed: number } }).data;
    expect(saved.before.lines.map((l) => l.descriptionOfGoods)).toEqual(['Alphonso Mango', 'Kesar Mango', 'Pomegranate']);
    expect([saved.added, saved.removed, saved.changed, saved.afterVersion]).toEqual([1, 2, 1, '2026-10-21T00:00:00.000Z']);
    expect(record).toMatchObject({ id: 'u1', added: 1, removed: 2, changed: 1, canUndo: true });
  });

  it('does nothing when the invoice changed since the file was checked', async () => {
    const update = jest.spyOn(invoiceService, 'updateRow');
    await expect(invoiceExcelUpdateService.apply('inv1', dto({ invoiceVersion: '2026-10-19T00:00:00.000Z' }) as never)).rejects.toMatchObject({ statusCode: 409, code: 'EXCEL_INVOICE_CHANGED' });
    expect(update).not.toHaveBeenCalled();
  });

  it('can be undone while nothing else has changed the invoice', async () => {
    const afterVersion = '2026-10-21T00:00:00.000Z';
    jest.spyOn(invoiceService, 'getById').mockResolvedValue(stored({ updatedAt: new Date(afterVersion), roundOff: 0 }) as never);
    const update = jest.spyOn(invoiceService, 'updateRow').mockResolvedValue({} as never);
    prismaMock.invoiceExcelUpdate.findFirst.mockResolvedValue({ id: 'u1', afterVersion, before: [{ descriptionOfGoods: 'Alphonso Mango', netWeightPerPackage: 10, numberOfBoxes: 100, ratePerKg: 1 }], fileName: 'f.xlsx', createdAt: new Date(), added: 0, removed: 0, changed: 1 } as never);
    expect((await invoiceExcelUpdateService.latest('inv1'))!.canUndo).toBe(true);
    await invoiceExcelUpdateService.undo('inv1');
    expect((update.mock.calls[0]![1] as { lineItems: unknown[]; amountInWords: string }).amountInWords).toBe('One Thousand');
    expect(prismaMock.invoiceExcelUpdate.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { undoneAt: expect.any(Date) } });
  });

  it('cannot be undone after the invoice was changed again, or when there is nothing to undo', async () => {
    prismaMock.invoiceExcelUpdate.findFirst.mockResolvedValue({ id: 'u1', afterVersion: '2026-10-21T00:00:00.000Z', before: [], fileName: null, createdAt: new Date(), added: 0, removed: 0, changed: 0 } as never);
    expect((await invoiceExcelUpdateService.latest('inv1'))!.canUndo).toBe(false);
    await expect(invoiceExcelUpdateService.undo('inv1')).rejects.toMatchObject({ statusCode: 409, code: 'EXCEL_UNDO_NOT_POSSIBLE' });
    prismaMock.invoiceExcelUpdate.findFirst.mockResolvedValue(null);
    expect(await invoiceExcelUpdateService.latest('inv1')).toBeNull();
    await expect(invoiceExcelUpdateService.undo('inv1')).rejects.toMatchObject({ code: 'EXCEL_UPDATE_NOT_FOUND' });
  });
});

describe('an invoice with a Party page and a Custom page', () => {
  const UPDATED_CUSTOM = new Date('2026-10-20T10:00:05.000Z'); // the Custom page is saved a moment after the Party page
  const customLines = [
    { id: 'c1', marksAndNos: 'CONT-01', containerNo: 'CONT-01', descriptionOfGoods: 'Alphonso Mango', netWeightPerPackage: 10, numberOfBoxes: 100, totalNetWeight: 1000, ratePerKg: 0.4, totalPerBox: 4, amount: 400 },
    { id: 'c2', marksAndNos: 'CONT-02', containerNo: 'CONT-02', descriptionOfGoods: 'Kesar Mango', netWeightPerPackage: 10, numberOfBoxes: 100, totalNetWeight: 1000, ratePerKg: 0.3, totalPerBox: 3, amount: 300 },
  ];
  const partyStored = () => stored({ invoiceKind: 'BOTH' });
  const customStored = () => stored({ id: 'inv2', isCompanion: true, invoiceKind: 'CUSTOM', updatedAt: UPDATED_CUSTOM, lineItems: customLines, totalBoxes: 200, totalNetWeight: 2000, subTotal: 700, total: 700 });
  const customSource = (): InvoiceSource => ({ ...source(), id: 'inv2', updatedAt: UPDATED_CUSTOM, invoiceKind: 'CUSTOM', lineItems: customLines, totalBoxes: 200, totalNetWeight: 2000, subTotal: 700, total: 700 });
  const bothDownload = () => renderInvoiceExcel([buildInvoiceDocument({ ...source(), invoiceKind: 'BOTH' }), buildInvoiceDocument(customSource())]);
  const LATEST = UPDATED_CUSTOM.toISOString();

  beforeEach(() => {
    jest.spyOn(invoiceService, 'getById').mockImplementation((async (id: string) => (id === 'inv2' ? customStored() : partyStored())) as never);
    prismaMock.invoice.findFirst.mockResolvedValue({ id: 'inv2' } as never);
  });

  /** Edits a sheet of the downloaded file: the Party sheet or the Custom sheet. */
  async function editedSheet(sheetPrefix: 'Party' | 'Custom', change: (sheet: ExcelJS.Worksheet, first: number) => void, base?: Buffer): Promise<Buffer> {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((base ?? (await bothDownload())) as never);
    const sheet = book.worksheets.find((w) => w.name.startsWith(sheetPrefix))!;
    let header = 0;
    sheet.eachRow((row, n) => { if (row.getCell(10).value === LINE_ID_HEADER) header = n; });
    change(sheet, header + 1);
    return Buffer.from(await book.xlsx.writeBuffer());
  }
  const run = (buffer: Buffer) => invoiceExcelUpdateService.preview('inv1', { buffer, originalname: 'both.xlsx' });

  it('is tagged with both pages in the file, and read back as two sheets', async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await bothDownload()) as never);
    const info = book.getWorksheet(INFO_SHEET)!;
    expect([info.getCell('B2').value, info.getCell('B4').value, info.getCell('B5').value]).toEqual(['inv1', 'yes', 'inv2']);
    expect(info.getCell('B3').value).toBe(LATEST); // the later of the two versions
    const read = readInvoiceExcel(await bothDownload());
    expect(read.pages.map((p) => [p.sheet.split(' ')[0], p.rows.map((r) => r.id)])).toEqual([['Party', ['l1', 'l2', 'l3']], ['Custom', ['c1', 'c2']]]);
    expect(read.meta).toMatchObject({ invoiceId: 'inv1', companionId: 'inv2', both: true });
  });

  it('compares each sheet with its own page and counts them separately', async () => {
    const afterParty = await editedSheet('Party', (sheet, first) => { sheet.getRow(first).getCell(5).value = 120; });
    const p = await run(await editedSheet('Custom', (sheet, first) => { sheet.getRow(first + 1).getCell(7).value = 0.35; sheet.spliceRows(first, 1); }, afterParty));
    expect(p.counts).toEqual({ added: 0, changed: 1, unchanged: 2, removed: 0 });
    expect(p.custom!.counts).toEqual({ added: 0, changed: 1, unchanged: 0, removed: 1 });
    expect(p.custom!.lines.map((l) => [l.id, l.status])).toEqual([['c2', 'changed']]);
    expect(p.custom!.removed.map((r) => r.id)).toEqual(['c1']);
    expect(p.custom!.totals.before.total).toBe(700);
    expect(p.custom!.totals.after.total).toBe(350); // 100 boxes x 10 kg x 0.35
    expect(p.totals.after.total).toBe(2200); // the Party page: 120 x 10 x 1 + 750 + 250
    expect(p.fileIsOlder).toBe(false);
    expect(p.canApply).toBe(true);
  });

  it('can be applied when only the Custom page changed, and says which page a warning is about', async () => {
    const p = await run(await editedSheet('Custom', (sheet, first) => { sheet.getRow(first).getCell(9).value = 12345; sheet.getRow(first).getCell(5).value = 90; }));
    expect(p.counts).toEqual({ added: 0, changed: 0, unchanged: 3, removed: 0 });
    expect(p.custom!.counts.changed).toBe(1);
    expect(p.canApply).toBe(true);
    expect(p.warnings.join(' ')).toMatch(/^Custom page, row \d+: the amount typed in Excel \(12345\.00\)/);
  });

  it('blocks the update when one page has a problem, even if the other is fine', async () => {
    const p = await run(await editedSheet('Custom', (sheet, first) => { sheet.getRow(first).getCell(5).value = 0; }));
    expect(p.custom!.lines[0]!.problems).toEqual(['Boxes must be a whole number, 1 or more']);
    expect(p.canApply).toBe(false);
  });

  it('needs both sheets in the file', async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await bothDownload()) as never);
    book.removeWorksheet(book.worksheets.find((w) => w.name.startsWith('Custom'))!.id);
    await expect(run(Buffer.from(await book.xlsx.writeBuffer()))).rejects.toMatchObject({ code: 'EXCEL_MISSING_PAGE' });
  });

  it('warns when either page changed after the download', async () => {
    jest.spyOn(invoiceService, 'getById').mockImplementation((async (id: string) => (id === 'inv2' ? { ...customStored(), updatedAt: new Date('2026-10-30T00:00:00.000Z') } : partyStored())) as never);
    expect((await run(await bothDownload())).fileIsOlder).toBe(true);
  });

  const lines = (id: string) => [{ id, descriptionOfGoods: 'Alphonso Mango', netWeightPerPackage: 10, numberOfBoxes: 120, ratePerKg: 1 }];
  const dto = (over: Record<string, unknown> = {}) => ({ lines: lines('l1'), customLines: [{ id: 'c2', descriptionOfGoods: 'Kesar Mango', netWeightPerPackage: 10, numberOfBoxes: 100, ratePerKg: 0.35 }], invoiceVersion: LATEST, fileName: 'both.xlsx', ...over });

  it('updates both pages and keeps both for undo', async () => {
    const update = jest.spyOn(invoiceService, 'updateRow').mockResolvedValueOnce({ updatedAt: new Date('2026-10-21T00:00:00.000Z') } as never).mockResolvedValueOnce({ updatedAt: new Date('2026-10-21T00:00:01.000Z') } as never);
    prismaMock.invoiceExcelUpdate.create.mockResolvedValue({ id: 'u1', fileName: 'both.xlsx', createdAt: new Date('2026-10-21T00:00:02.000Z') } as never);
    const record = await invoiceExcelUpdateService.apply('inv1', dto() as never);
    expect(update.mock.calls.map((c) => [c[0], (c[1] as { lineItems: { descriptionOfGoods: string }[] }).lineItems.map((l) => l.descriptionOfGoods)])).toEqual([['inv1', ['Alphonso Mango']], ['inv2', ['Kesar Mango']]]);
    expect((update.mock.calls[1]![1] as { amountInWords: string }).amountInWords).toBe('Three Hundred Fifty');
    const saved = (prismaMock.invoiceExcelUpdate.create.mock.calls[0]![0] as unknown as { data: { before: { lines: unknown[]; customLines: { descriptionOfGoods: string }[] }; afterVersion: string } }).data;
    expect(saved.before.lines).toHaveLength(3);
    expect(saved.before.customLines.map((l) => l.descriptionOfGoods)).toEqual(['Alphonso Mango', 'Kesar Mango']);
    expect(saved.afterVersion).toBe('2026-10-21T00:00:01.000Z'); // the later of the two pages
    // Party: 1 changed (l1), 2 removed. Custom: 1 changed (c2), 1 removed (c1)
    expect(record).toMatchObject({ added: 0, changed: 2, removed: 3 });
  });

  it('puts the Party page back when the Custom page cannot be saved', async () => {
    const update = jest.spyOn(invoiceService, 'updateRow')
      .mockResolvedValueOnce({ updatedAt: new Date('2026-10-21T00:00:00.000Z') } as never)
      .mockRejectedValueOnce(new Error('database down'))
      .mockResolvedValueOnce({} as never);
    await expect(invoiceExcelUpdateService.apply('inv1', dto() as never)).rejects.toThrow('database down');
    expect(update).toHaveBeenCalledTimes(3);
    expect(update.mock.calls[2]![0]).toBe('inv1');
    expect((update.mock.calls[2]![1] as { lineItems: unknown[] }).lineItems).toHaveLength(3); // the Party lines as they were
    expect(prismaMock.invoiceExcelUpdate.create).not.toHaveBeenCalled();
  });

  it('refuses an update without the Custom lines, one that is out of date, and Custom lines for a plain invoice', async () => {
    await expect(invoiceExcelUpdateService.apply('inv1', dto({ customLines: undefined }) as never)).rejects.toMatchObject({ code: 'EXCEL_CUSTOM_LINES_MISSING' });
    await expect(invoiceExcelUpdateService.apply('inv1', dto({ invoiceVersion: UPDATED.toISOString() }) as never)).rejects.toMatchObject({ code: 'EXCEL_INVOICE_CHANGED' });
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    jest.spyOn(invoiceService, 'getById').mockResolvedValue(stored() as never);
    await expect(invoiceExcelUpdateService.apply('inv1', dto({ invoiceVersion: UPDATED.toISOString() }) as never)).rejects.toMatchObject({ code: 'EXCEL_NO_CUSTOM_PAGE' });
  });

  it('undoes both pages together', async () => {
    const afterVersion = '2026-10-21T00:00:01.000Z';
    jest.spyOn(invoiceService, 'getById').mockImplementation((async (id: string) => (id === 'inv2' ? { ...customStored(), updatedAt: new Date(afterVersion) } : { ...partyStored(), updatedAt: new Date('2026-10-21T00:00:00.000Z') })) as never);
    const update = jest.spyOn(invoiceService, 'updateRow').mockResolvedValue({} as never);
    prismaMock.invoiceExcelUpdate.findFirst.mockResolvedValue({ id: 'u1', afterVersion, fileName: null, createdAt: new Date(), added: 0, removed: 0, changed: 1,
      before: { lines: [{ descriptionOfGoods: 'Alphonso Mango', netWeightPerPackage: 10, numberOfBoxes: 100, ratePerKg: 1 }], customLines: [{ descriptionOfGoods: 'Kesar Mango', netWeightPerPackage: 10, numberOfBoxes: 100, ratePerKg: 0.3 }] } } as never);
    expect((await invoiceExcelUpdateService.latest('inv1'))!.canUndo).toBe(true);
    await invoiceExcelUpdateService.undo('inv1');
    expect(update.mock.calls.map((c) => c[0])).toEqual(['inv1', 'inv2']);
    expect((update.mock.calls[1]![1] as { amountInWords: string }).amountInWords).toBe('Three Hundred');
  });

  it('cannot be undone once either page was changed again', async () => {
    prismaMock.invoiceExcelUpdate.findFirst.mockResolvedValue({ id: 'u1', afterVersion: '2026-10-21T00:00:01.000Z', before: { lines: [] }, fileName: null, createdAt: new Date(), added: 0, removed: 0, changed: 0 } as never);
    expect((await invoiceExcelUpdateService.latest('inv1'))!.canUndo).toBe(false);
  });
});

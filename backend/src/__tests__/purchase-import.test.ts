import * as XLSX from 'xlsx';
import { parseDateText, parseNumber, parsePurchaseWorkbook } from '../services/purchase-import';

type Row = (string | number | Date | null)[];

/** A workbook file from rows of cells (dates become real Excel dates). */
function file(rows: Row[], type: 'xlsx' | 'xls' = 'xlsx'): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Invoice');
  return XLSX.write(book, { type: 'buffer', bookType: type === 'xls' ? 'biff8' : 'xlsx', cellDates: true }) as Buffer;
}
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12));

/** How one supplier lays out its invoice: details at the top, "Particulars" table, totals underneath. */
const mapoose = (): Row[] => [
  ['MAPOOSE TRADERS'],
  ['Invoice No:', 'MP/26/118', null, 'Date:', day(2026, 10, 10)],
  ['Purchase Date', '12.10.2026'],
  [],
  ['S.No', 'Particulars', 'Qty (Boxes)', 'Net Wt (Kgs)', 'Rate / Kg', 'Amount'],
  [1, 'Amla', 19, 95, 14.75, 1401.25],
  [2, 'Banana', 2, 30, 14.1, 423],
  [],
  [null, 'Sub Total', null, 125, null, 1824.25],
  [null, 'Freight', null, null, null, 300],
  [null, 'Loading charges', null, null, null, 50],
  [null, 'CGST 2.5%', null, null, null, 45.61],
  [null, 'SGST 2.5%', null, null, null, 45.61],
  [null, 'Grand Total', null, null, null, 2265.47],
];

/** Another supplier: other words for the same things, the details in the top right. */
const sunil = (): Row[] => [
  ['Sunil Fruit Co.', null, null, 'Bill No.', 'SF-2210'],
  ['GSTIN: 27ABCDE1234F1Z5', null, null, 'Bill Date', '26/10/2026'],
  [],
  ['Sr', 'Item Name', 'Nos', 'Qty (Kgs)', 'Price', 'Value'],
  [1, 'Drumstick', 20, 200, 14.5, 2900],
  [2, 'Mullai', 1, 5, 13.5, 67.5],
  [null, 'Total Value', null, 205, null, 2967.5],
  [null, 'GST @5%', null, null, null, 148.38],
  [null, 'Transport', null, null, null, 120],
  [null, 'Net Payable', null, null, null, 3235.88],
];

const suppliers = [{ id: 's-mapoose', name: 'Mapoose' }, { id: 's-sunil', name: 'Sunil' }];

describe('parseNumber and parseDateText', () => {
  it('reads Indian and plain numbers', () => {
    expect(parseNumber('1,23,456.50')).toBe(123456.5);
    expect(parseNumber('₹ 1,200/-')).toBe(1200);
    expect(parseNumber('(500.00)')).toBe(-500);
    expect(parseNumber('45 kg')).toBe(45);
    expect(parseNumber('Amla')).toBeNull();
    expect(parseNumber('')).toBeNull();
  });

  it('reads dates written the usual ways, day first', () => {
    expect(parseDateText('10.10.26')).toBe('2026-10-10');
    expect(parseDateText('26/10/2026')).toBe('2026-10-26');
    expect(parseDateText('2026-10-26')).toBe('2026-10-26');
    expect(parseDateText('10 Oct 2026')).toBe('2026-10-10');
    expect(parseDateText('Oct 10, 2026')).toBe('2026-10-10');
    expect(parseDateText('31/02/2026')).toBeNull();
    expect(parseDateText('hello')).toBeNull();
  });
});

describe('parsePurchaseWorkbook', () => {
  it('reads an invoice laid out one way with nothing set up', () => {
    const p = parsePurchaseWorkbook(file(mapoose()), { fileName: 'mapoose-118.xlsx', suppliers });
    expect(p.supplierId).toBe('s-mapoose');
    expect(p.invoiceNumber).toBe('MP/26/118');
    expect(p.invoiceDate).toBe('2026-10-10');
    expect(p.purchaseDate).toBe('2026-10-12');
    expect(p.lines).toEqual([
      { productName: 'Amla', quantity: 19, netWeight: 95, rate: 14.75, rateBasis: 'KG', amount: 1401.25 },
      { productName: 'Banana', quantity: 2, netWeight: 30, rate: 14.1, rateBasis: 'KG', amount: 423 },
    ]);
    expect(p.subTotal).toBe(1824.25);
    expect(p.freight).toBe(300);
    expect(p.otherCharges).toBe(50);
    expect(p.taxAmount).toBe(91.22); // CGST + SGST
    expect(p.total).toBe(2265.47);
    expect(p.warnings).toEqual([]);
    expect(p.found['invoiceNumber']).toBe('B2');
    expect(p.fileHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reads another supplier\'s different words and layout, and the older .xls format', () => {
    for (const type of ['xlsx', 'xls'] as const) {
      const p = parsePurchaseWorkbook(file(sunil(), type), { fileName: 'sunil.' + type, suppliers });
      expect(p.supplierId).toBe('s-sunil');
      expect(p.invoiceNumber).toBe('SF-2210');
      expect(p.invoiceDate).toBe('2026-10-26');
      expect(p.lines.map((l) => [l.productName, l.netWeight, l.rate, l.amount])).toEqual([['Drumstick', 200, 14.5, 2900], ['Mullai', 5, 13.5, 67.5]]);
      expect(p.subTotal).toBe(2967.5);
      expect(p.taxAmount).toBe(148.38);
      expect(p.freight).toBe(120);
      expect(p.total).toBe(3235.88);
    }
  });

  it('works out an amount or a rate that the file leaves blank, and the total when there is none', () => {
    const rows: Row[] = [
      ['Invoice No', 'X-1'], ['Invoice Date', '01/10/2026'], [],
      ['Item', 'Net Weight', 'Rate', 'Amount'],
      ['Amla', 10, 12, null],
      ['Banana', 20, null, 300],
    ];
    const p = parsePurchaseWorkbook(file(rows), { fileName: 'x.xlsx' });
    expect(p.lines.map((l) => [l.rate, l.amount])).toEqual([[12, 120], [15, 300]]);
    expect(p.subTotal).toBe(420);
    expect(p.total).toBe(420);
  });

  it('prices by the unit when the rate is per box, not per kilo', () => {
    const rows: Row[] = [['Invoice No', 'B-9'], ['Date', '02/10/2026'], [], ['Description', 'Qty', 'Rate', 'Amount'], ['Banana boxes', 20, 150, 3000]];
    expect(parsePurchaseWorkbook(file(rows), { fileName: 'b.xlsx' }).lines[0]).toMatchObject({ rateBasis: 'UNIT', quantity: 20, rate: 150, amount: 3000 });
  });

  it('follows the supplier\'s template when the titles and places are unusual', () => {
    const rows: Row[] = [
      ['Ref', 'Z-77'], ['Bought on', '05/10/2026'], [],
      ['Fruit', 'Kilos', 'Cost', 'Cost Total'],
      ['Amla', 50, 20, 1000],
      ['Final', null, null, 1000],
    ];
    const template = {
      headerRow: 4,
      fields: { invoiceNumber: { cell: 'B1' }, invoiceDate: { cell: 'B2' } },
      columns: { description: 'Fruit', netWeight: 'Kilos', rate: 'Cost', amount: 'Cost Total' },
      stopAt: 'Final',
    };
    const p = parsePurchaseWorkbook(file(rows), { fileName: 'z.xlsx', template });
    expect(p.invoiceNumber).toBe('Z-77');
    expect(p.invoiceDate).toBe('2026-10-05');
    expect(p.lines).toEqual([{ productName: 'Amla', netWeight: 50, rate: 20, rateBasis: 'KG', amount: 1000 }]);
  });

  it('says what it could not find instead of guessing', () => {
    const p = parsePurchaseWorkbook(file([['Hello'], ['nothing useful here']]), { fileName: 'junk.xlsx' });
    expect(p.lines).toEqual([]);
    expect(p.invoiceNumber).toBe('');
    expect(p.warnings.join(' ')).toMatch(/table of products was not found/);
    expect(p.warnings.join(' ')).toMatch(/invoice number was not found/);
  });

  it('warns when the figures on the invoice do not add up', () => {
    const rows = mapoose();
    rows[13] = [null, 'Grand Total', null, null, null, 9999];
    expect(parsePurchaseWorkbook(file(rows), { fileName: 'm.xlsx' }).warnings.join(' ')).toMatch(/total differs/);
  });

  describe('a bill with packing per box, a weight per box and charges under the products', () => {
    /** MR Global's layout: a labelled supplier, an invoice date with no label, two "TOTAL" columns and a table that starts in column B. */
    const bill = (): Row[] => [
      [],
      [],
      [null, 'Supplier NAME', 'Md Mahfuz Alam', null, null, 'INVOICE NO', 'MR-337-26', null, day(2026, 9, 22)],
      [null, 'COMPANY NAME', 'MR GLOBAL'],
      [null, 'EXPORT NAME', 'ZIYAN IMPEX', null, null, 'CONSUTMENT', null, null, 'CANADA'],
      [null, 'DESCRIPTION', 'CTN/Bags', 'N.WT/ BOX', 'BOX', 'T NET', 'RATE', 'TOTAL', 'PER BOX', 'BOX TOTAL', 'TOTAL'],
      [null, null, null, null, null, null, null, null, null, null, null, 'PER KG'],
      [null, 'BABY KARELA', 'BOX', 5, 5, 25, 66, 1650, 104, 520, 2170, 87],
      [null, 'GAWAR', 'T COOL', 7, 2, 14, 90, 1260, 216, 432, 1692, 121],
      [],
      [null, 'AIRPORT TRANSPORT', null, null, null, null, null, 1, 2500, 0, 2500],
      [null, 'LOCAL TRANSPORT', null, null, null, null, null, 1, 600, 0, 600],
      [null, 'COLD ITEM', null, null, null, null, null, 85, 20, 0, 1700],
      [null, 'TOTAL - ', null, null, null, null, null, null, null, null, 8662],
      [null, 'Declaration :-'],
    ];

    it('reads the weight of the line, the goods amount, the box packing and the charges apart', () => {
      const parsed = parsePurchaseWorkbook(file(bill()), { fileName: 'bill.xlsx' });
      expect(parsed.lines).toEqual([
        { productName: 'BABY KARELA', quantity: 5, netWeight: 25, unit: 'BOX', rate: 66, rateBasis: 'KG', amount: 1650 },
        { productName: 'GAWAR', quantity: 2, netWeight: 14, unit: 'T COOL', rate: 90, rateBasis: 'KG', amount: 1260 },
      ]);
      expect([parsed.subTotal, parsed.freight, parsed.otherCharges, parsed.total]).toEqual([2910, 3100, 2652, 8662]);
      expect(parsed.warnings).toEqual([]);
    });

    it('finds the invoice number and the date that has no label', () => {
      const parsed = parsePurchaseWorkbook(file(bill()), { fileName: 'bill.xlsx' });
      expect([parsed.invoiceNumber, parsed.invoiceDate]).toEqual(['MR-337-26', '2026-09-22']);
    });

    it('recognises a saved supplier spelt a little differently, and ignores the exporter named on the bill', () => {
      const saved = [{ id: 'm', name: 'Mehfooz' }, { id: 'z', name: 'Ziyan' }];
      expect(parsePurchaseWorkbook(file(bill()), { fileName: 'ZIYAN IMPEX CANADA BILL 22.09.2026.xlsx', suppliers: [saved[0]!] }).supplierId).toBe('m');
      expect(parsePurchaseWorkbook(file(bill()), { fileName: 'bill.xlsx', suppliers: [{ id: 'x', name: 'Sunil' }] }).supplierId).toBeNull();
    });

    it('suggests the supplier written on the bill when none is saved', () => {
      const parsed = parsePurchaseWorkbook(file(bill()), { fileName: 'bill.xlsx', suppliers: [{ id: 'x', name: 'Sunil' }] });
      expect(parsed.supplierGuess).toBe('Md Mahfuz Alam');
    });

    it('works out the weight from the boxes when there is no total weight column', () => {
      const rows = bill().map((r) => r.map((c) => (c === 'T NET' ? 'Remarks' : c)));
      rows[7]![5] = null; rows[8]![5] = null;
      const parsed = parsePurchaseWorkbook(file(rows), { fileName: 'bill.xlsx' });
      expect(parsed.lines.map((l) => l.netWeight)).toEqual([25, 14]);
    });
  });

  it('rejects a file that is not a spreadsheet', () => {
    expect(() => parsePurchaseWorkbook(Buffer.from('this is not excel'), { fileName: 'a.xlsx' })).toThrow();
  });
});

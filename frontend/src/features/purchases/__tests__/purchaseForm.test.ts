import { describe, expect, it } from 'vitest';
import { blankLine, emptyPurchase, expectedTotal, fromParsed, fromSaved, lineAmount, problemsOf, toDto } from '../utils/purchaseForm';
import type { PurchaseInvoice } from '../services/purchaseService';
import { dateLabel, inr, productKey } from '../utils/format';

describe('purchase form helpers', () => {
  it('prices a line by kilo or by unit', () => {
    expect(lineAmount({ rate: 12.5, rateBasis: 'KG', netWeight: 100, quantity: 5 })).toBe(1250);
    expect(lineAmount({ rate: 12.5, rateBasis: 'UNIT', netWeight: 100, quantity: 5 })).toBe(62.5);
    expect(lineAmount({ rate: undefined, rateBasis: 'KG', netWeight: 100, quantity: 5 })).toBeUndefined();
  });

  it('adds the charges to the subtotal', () => {
    expect(expectedTotal({ subTotal: 1000, taxAmount: 50, freight: 20.5, otherCharges: undefined })).toBe(1070.5);
  });

  it('lists what stops a purchase being saved', () => {
    expect(problemsOf(emptyPurchase())).toHaveLength(4);
    const ok = { ...emptyPurchase(), supplierId: 's1', invoiceNumber: 'A-1', invoiceDate: '2026-10-10', lines: [{ ...blankLine(), productName: 'Amla' }] };
    expect(problemsOf(ok)).toEqual([]);
  });

  it('drops blank lines and fills the totals when sending', () => {
    const v = { ...emptyPurchase(), supplierId: 's1', invoiceNumber: ' A-1 ', invoiceDate: '2026-10-10', taxAmount: 5,
      lines: [{ ...blankLine(), productName: 'Amla', netWeight: 10, rate: 20, amount: 200 }, blankLine()] };
    const dto = toDto(v);
    expect(dto.lines).toHaveLength(1);
    expect(dto.invoiceNumber).toBe('A-1');
    expect(dto.subTotal).toBe(200);
    expect(dto.total).toBe(205);
  });

  it('sends the connected actual invoice only when one is chosen', () => {
    const base = { ...emptyPurchase(), supplierId: 's1', invoiceNumber: 'A-1', invoiceDate: '2026-10-10', lines: [{ ...blankLine(), productName: 'Amla', netWeight: 10, rate: 20, amount: 200 }] };
    expect(toDto(base).invoiceId).toBeUndefined();
    expect(toDto({ ...base, invoiceId: 'inv1', invoiceLabel: 'ACTUAL 12' }).invoiceId).toBe('inv1');
  });

  it('shows the connected invoice of a saved purchase', () => {
    const saved = { id: 'p1', supplierId: 's1', supplierName: 'Mahfuz', invoiceNumber: 'MR-1', invoiceDate: '2026-10-10', purchaseDate: null, dueDate: null, currency: 'INR', subTotal: 0, taxAmount: 0, freight: 0, otherCharges: 0, total: 0, notes: null, sourceFileName: null,
      invoiceId: 'inv1', invoice: { id: 'inv1', invoiceNumber: 'ACTUAL 12', invoiceDate: '2026-10-20', currency: 'CAD', importerName: 'Ziyan' }, createdAt: '', updatedAt: '', lines: [] } as PurchaseInvoice;
    expect(fromSaved(saved)).toMatchObject({ invoiceId: 'inv1', invoiceLabel: 'ACTUAL 12 · Ziyan' });
    expect(fromSaved({ ...saved, invoiceId: null, invoice: null })).toMatchObject({ invoiceId: '', invoiceLabel: '' });
  });

  it('starts the review screen from a parsed file', () => {
    const v = fromParsed({ supplierId: 's1', supplierName: 'Mapoose', invoiceNumber: 'M-9', invoiceDate: '2026-10-10', purchaseDate: null, dueDate: null,
      lines: [{ productName: 'Amla', rate: 20, rateBasis: 'KG', amount: 200, netWeight: 10 }], subTotal: null, taxAmount: 10, freight: 0, otherCharges: 0, total: null,
      fileName: 'm.xlsx', fileHash: 'abc', warnings: [], duplicates: [] } as never);
    expect(v.subTotal).toBe(200);
    expect(v.total).toBe(210);
    expect(v.sourceHash).toBe('abc');
  });

  it('formats rupees, dates and product keys', () => {
    expect(inr(123456.5)).toBe('₹ 1,23,456.50');
    expect(dateLabel('2026-10-26')).toBe('26 Oct 2026');
    expect(dateLabel(null)).toBe('—');
    expect(productKey('  AMLA   Fresh ')).toBe('amla fresh');
  });
});

import { describe, expect, it } from 'vitest';
import { actualInvoiceState } from '../services/invoiceService';

describe('actualInvoiceState', () => {
  it('can be created for a plain invoice', () => {
    expect(actualInvoiceState({})).toEqual({ canCreate: true, label: 'Create actual invoice' });
    expect(actualInvoiceState({ actuals: [] }).canCreate).toBe(true);
  });
  it('cannot once an actual exists', () => {
    expect(actualInvoiceState({ actuals: [{ id: 'a', invoiceNumber: 'ACTUAL X' }] })).toEqual({ canCreate: false, label: 'Actual invoice already created' });
  });
  it('cannot on an actual invoice itself', () => {
    expect(actualInvoiceState({ actualOfId: 'orig' })).toEqual({ canCreate: false, label: 'This is already the actual invoice' });
  });
});

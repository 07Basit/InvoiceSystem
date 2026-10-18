import { describe, expect, it } from 'vitest';
import { actualInvoiceState, canHaveActual, counterpartState, printedNumberOf } from '../services/invoiceService';

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

describe('counterpartState (party / custom partner)', () => {
  it('offers a custom invoice from a party invoice, and a party invoice from a custom one', () => {
    expect(counterpartState({ invoiceKind: 'PARTY' })).toEqual({ available: true, canCreate: true, label: 'Create custom invoice', target: 'Custom' });
    expect(counterpartState({ invoiceKind: 'CUSTOM' })).toEqual({ available: true, canCreate: true, label: 'Create party invoice', target: 'Party' });
  });

  it('is not available at all on a normal invoice', () => {
    expect(counterpartState({ invoiceKind: 'NORMAL' })).toMatchObject({ available: false, canCreate: false });
    expect(counterpartState({})).toMatchObject({ available: false, canCreate: false });
  });

  it('is not available on an actual invoice, whatever its kind', () => {
    expect(counterpartState({ invoiceKind: 'PARTY', actualOfId: 'orig' })).toMatchObject({ available: false, canCreate: false });
    expect(counterpartState({ invoiceKind: 'CUSTOM', actualOfId: 'orig' })).toMatchObject({ available: false });
  });

  it('is used up once the partner exists, from either side', () => {
    expect(counterpartState({ invoiceKind: 'PARTY', counterparts: [{ id: 'x', invoiceNumber: 'A (Custom)', invoiceKind: 'CUSTOM' }] })).toMatchObject({ available: true, canCreate: false, label: 'Custom invoice already created' });
    expect(counterpartState({ invoiceKind: 'CUSTOM', counterpartOfId: 'y', counterpartOf: { id: 'y', invoiceNumber: 'A', invoiceKind: 'PARTY' } })).toMatchObject({ canCreate: false, label: 'Party invoice already created' });
  });
});

describe('canHaveActual', () => {
  it('is false only for a custom invoice', () => {
    expect(canHaveActual({ invoiceKind: 'CUSTOM' })).toBe(false);
    expect(canHaveActual({ invoiceKind: 'PARTY' })).toBe(true);
    expect(canHaveActual({ invoiceKind: 'NORMAL' })).toBe(true);
    expect(canHaveActual({})).toBe(true);
  });
});

describe('printedNumberOf', () => {
  it('prefers the saved printed number, then the actual link, then the own number', () => {
    expect(printedNumberOf({ invoiceNumber: 'SMP-1 (Custom)', printedNumber: 'SMP-1' })).toBe('SMP-1');
    expect(printedNumberOf({ invoiceNumber: 'ACTUAL SMP-2', actualOf: { id: 'a', invoiceNumber: 'SMP-2' } })).toBe('SMP-2');
    expect(printedNumberOf({ invoiceNumber: 'SMP-3' })).toBe('SMP-3');
  });
});

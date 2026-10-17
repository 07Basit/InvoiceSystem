import { prismaMock } from './setup';
import { assertGrossAtLeastNet, invoiceService, snapshotChanges, snapshotFromImporter } from '../services/invoice.service';

const importer = { name: 'ABC Foods', address: '1 Main St', contact: '+1 555 0100', email: 'abc@example.com' };

describe('snapshotFromImporter (a new invoice)', () => {
  it('copies the importer\'s details when the caller sent nothing', () => {
    expect(snapshotFromImporter(importer, {})).toEqual({
      importerName: 'ABC Foods', importerAddress: '1 Main St', importerContact: '+1 555 0100', importerEmail: 'abc@example.com',
    });
  });

  it('keeps what the form sent, even if it differs from the importer (the form is prefilled and editable)', () => {
    const s = snapshotFromImporter(importer, { importerName: ' ABC Foods Ltd ', importerAddress: '2 Other Rd' });
    expect(s.importerName).toBe('ABC Foods Ltd');
    expect(s.importerAddress).toBe('2 Other Rd');
    expect(s.importerContact).toBe('+1 555 0100'); // not sent -> copied
  });

  it('treats a blank address/contact/email as "leave empty", but a blank name falls back to the importer\'s name', () => {
    expect(snapshotFromImporter(importer, { importerName: '  ', importerAddress: '', importerContact: ' ', importerEmail: '' })).toEqual({
      importerName: 'ABC Foods', importerAddress: null, importerContact: null, importerEmail: null,
    });
  });

  it('copes with an importer that has no contact or email', () => {
    expect(snapshotFromImporter({ ...importer, contact: null, email: null }, {})).toMatchObject({ importerContact: null, importerEmail: null });
  });
});

describe('snapshotChanges (editing an invoice)', () => {
  const current = { importerName: 'ABC Foods (as invoiced)' };

  it('changes nothing when the form sends no importer details and the importer is the same, even if the importer was renamed since', () => {
    const renamed = { ...importer, name: 'ABC Foods Renamed', address: 'New Address' };
    expect(snapshotChanges({}, renamed, current, false)).toEqual({});
  });

  it('applies the values the form sent', () => {
    expect(snapshotChanges({ importerAddress: '9 New St', importerEmail: '' }, importer, current, false)).toEqual({ importerAddress: '9 New St', importerEmail: null });
  });

  it('keeps the invoice\'s own name when the form sends a blank one', () => {
    expect(snapshotChanges({ importerName: ' ' }, importer, current, false)).toEqual({ importerName: 'ABC Foods (as invoiced)' });
  });

  it('takes the new importer\'s details when the invoice is moved to another importer', () => {
    expect(snapshotChanges({}, importer, current, true)).toEqual({
      importerName: 'ABC Foods', importerAddress: '1 Main St', importerContact: '+1 555 0100', importerEmail: 'abc@example.com',
    });
  });

  it('lets the form override even on a move', () => {
    expect(snapshotChanges({ importerName: 'Custom' }, importer, current, true)).toMatchObject({ importerName: 'Custom', importerAddress: '1 Main St' });
  });
});

describe('invoiceService.update with a deleted importer', () => {
  const invoiceRow = {
    id: 'inv1', importerId: 'imp1', importerName: 'ABC Foods', roundOff: 0, deletedAt: null,
    lineItems: [{ marksAndNos: null, containerNo: null, descriptionOfGoods: 'x', netWeightPerPackage: 1, numberOfBoxes: 1, ratePerKg: 1 }],
  };

  it('still works when the invoice\'s own importer has been deleted since (the invoice is independent)', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(invoiceRow as never);
    prismaMock.importer.findFirst.mockResolvedValue({ id: 'imp1', ...importer, isActive: true, landingLocations: [], loadingLocations: [] } as never);
    prismaMock.$transaction.mockImplementation((async (fn: unknown) => (typeof fn === 'function' ? fn(prismaMock) : fn)) as never);
    prismaMock.invoice.update.mockResolvedValue({ id: 'inv1' } as never);

    await invoiceService.update('inv1', { notes: 'edited' } as never);
    // the importer lookup must not require it to be live when the invoice keeps its importer
    expect(prismaMock.importer.findFirst.mock.calls[0]![0]).toMatchObject({ where: { id: 'imp1' } });
    expect((prismaMock.importer.findFirst.mock.calls[0]![0] as { where: Record<string, unknown> }).where).not.toHaveProperty('deletedAt');
  });

  it('still requires a new importer to be live when the invoice is moved', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(invoiceRow as never);
    prismaMock.importer.findFirst.mockResolvedValue(null);
    await expect(invoiceService.update('inv1', { importerId: 'imp2' } as never)).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.importer.findFirst.mock.calls.at(-1)![0]).toMatchObject({ where: { id: 'imp2', deletedAt: null } });
  });
});

describe('assertGrossAtLeastNet', () => {
  it('rejects a gross weight below the nett weight', () => {
    expect(() => assertGrossAtLeastNet(90, 100)).toThrow(/gross weight/i);
  });

  it('accepts equal or higher gross weight, and no gross weight at all', () => {
    expect(() => assertGrossAtLeastNet(100, 100)).not.toThrow();
    expect(() => assertGrossAtLeastNet(120, 100)).not.toThrow();
    expect(() => assertGrossAtLeastNet(undefined, 100)).not.toThrow();
    expect(() => assertGrossAtLeastNet(null, 100)).not.toThrow();
  });
});

import { prismaMock } from './setup';
import { notificationService, toDto } from '../services/notification.service';
import { events } from '../services/notification.events';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'n1', userId: 'u1', type: 'info', category: 'invoice', title: 'T', message: 'M', details: null, link: null, linkLabel: null,
  actorName: 'Basit', readAt: null, createdAt: new Date('2026-10-17T10:00:00Z'), ...over,
});

describe('toDto', () => {
  it('parses the JSON details and formats dates', () => {
    const dto = toDto(row({ details: JSON.stringify([{ label: 'Total', value: 'USD 10.00' }]), readAt: new Date('2026-10-17T11:00:00Z') }) as never);
    expect(dto.details).toEqual([{ label: 'Total', value: 'USD 10.00' }]);
    expect(dto.readAt).toBe('2026-10-17T11:00:00.000Z');
    expect(dto.createdAt).toBe('2026-10-17T10:00:00.000Z');
  });

  it('copes with missing or corrupt details', () => {
    expect(toDto(row() as never).details).toEqual([]);
    expect(toDto(row({ details: '{not json' }) as never).details).toEqual([]);
    expect(toDto(row({ details: '{"a":1}' }) as never).details).toEqual([]); // not an array
  });
});

describe('notificationService.notifyAll', () => {
  it('creates one notification per user', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }] as never);
    await notificationService.notifyAll('Basit', {
      type: 'success', category: 'invoice', title: 'Invoice A created', message: 'msg',
      details: [{ label: 'Total', value: '1' }], link: '/invoices/x', linkLabel: 'Open invoice',
    });
    const data = (prismaMock.notification.createMany.mock.calls[0]![0] as { data: Array<Record<string, unknown>> }).data;
    expect(data.map((d) => d['userId'])).toEqual(['u1', 'u2']);
    expect(data[0]).toMatchObject({ title: 'Invoice A created', actorName: 'Basit', link: '/invoices/x', details: JSON.stringify([{ label: 'Total', value: '1' }]) });
  });

  it('prunes notifications older than 90 days', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1' }] as never);
    await notificationService.notifyAll(null, { type: 'info', category: 'system', title: 'x' });
    const where = (prismaMock.notification.deleteMany.mock.calls[0]![0] as { where: { createdAt: { lt: Date } } }).where;
    const days = (Date.now() - where.createdAt.lt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(90);
  });

  it('does nothing when there are no users', async () => {
    prismaMock.user.findMany.mockResolvedValue([] as never);
    await notificationService.notifyAll(null, { type: 'info', category: 'system', title: 'x' });
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
  });

  it('never throws, so the real action (saving an invoice) cannot fail because of it', async () => {
    prismaMock.user.findMany.mockRejectedValue(new Error('db down') as never);
    await expect(notificationService.notifyAll(null, { type: 'info', category: 'system', title: 'x' })).resolves.toBeUndefined();
  });
});

describe('notificationService.list', () => {
  it('only returns the signed-in user\'s notifications, newest first, with page meta', async () => {
    prismaMock.$transaction.mockResolvedValue([[row()], 25] as never);
    const result = await notificationService.list('u1', { page: 2, limit: 10, status: 'all' });
    const args = prismaMock.notification.findMany.mock.calls.at(-1)![0] as { where: Record<string, unknown>; orderBy: unknown; skip: number; take: number };
    expect(args.where).toEqual({ userId: 'u1' });
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(args).toMatchObject({ skip: 10, take: 10 });
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3, hasNext: true, hasPrev: true });
  });

  it('filters unread and by category', async () => {
    prismaMock.$transaction.mockResolvedValue([[], 0] as never);
    await notificationService.list('u1', { page: 1, limit: 10, status: 'unread', category: 'currency' });
    const where = (prismaMock.notification.findMany.mock.calls.at(-1)![0] as { where: Record<string, unknown> }).where;
    expect(where).toEqual({ userId: 'u1', readAt: null, category: 'currency' });
  });
});

describe('notificationService read/unread/delete', () => {
  it('marks as read once, keeping the first read time', async () => {
    const earlier = new Date('2026-10-17T09:00:00Z');
    prismaMock.notification.findFirst.mockResolvedValue(row({ readAt: earlier }) as never);
    prismaMock.notification.update.mockResolvedValue(row({ readAt: earlier }) as never);
    await notificationService.setRead('u1', 'n1', true);
    expect((prismaMock.notification.update.mock.calls[0]![0] as { data: { readAt: Date } }).data.readAt).toBe(earlier);
  });

  it('can put one back to unread', async () => {
    prismaMock.notification.findFirst.mockResolvedValue(row({ readAt: new Date() }) as never);
    prismaMock.notification.update.mockResolvedValue(row() as never);
    await notificationService.setRead('u1', 'n1', false);
    expect((prismaMock.notification.update.mock.calls[0]![0] as { data: { readAt: null } }).data.readAt).toBeNull();
  });

  it('404s for somebody else\'s or a missing notification', async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);
    await expect(notificationService.getOne('u2', 'n1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(notificationService.setRead('u2', 'n1', true)).rejects.toMatchObject({ statusCode: 404 });
    prismaMock.notification.deleteMany.mockResolvedValue({ count: 0 } as never);
    await expect(notificationService.remove('u2', 'n1')).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.notification.findFirst.mock.calls[0]![0]).toMatchObject({ where: { id: 'n1', userId: 'u2' } });
  });

  it('marks all read, and clears only the read ones', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 3 } as never);
    expect(await notificationService.markAllRead('u1')).toBe(3);
    expect(prismaMock.notification.updateMany.mock.calls[0]![0]).toMatchObject({ where: { userId: 'u1', readAt: null } });

    prismaMock.notification.deleteMany.mockResolvedValue({ count: 2 } as never);
    expect(await notificationService.clearRead('u1')).toBe(2);
    expect(prismaMock.notification.deleteMany.mock.calls.at(-1)![0]).toMatchObject({ where: { userId: 'u1', readAt: { not: null } } });
  });
});

describe('events', () => {
  const invoice = {
    id: 'inv1', invoiceNumber: 'INV-9', invoiceDate: new Date('2026-09-15T00:00:00Z'), total: 1500, currency: 'CAD', totalBoxes: 4,
    importer: { name: 'North Maple Foods' },
  };

  const lastSent = () => (prismaMock.notification.createMany.mock.calls.at(-1)![0] as { data: Array<Record<string, unknown>> }).data[0]!;

  beforeEach(() => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1' }] as never);
  });

  it('describes a created invoice with its key facts and a link to it', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(invoice as never);
    await events.invoiceCreated('Basit', 'inv1');
    const sent = lastSent();
    expect(sent).toMatchObject({ type: 'success', category: 'invoice', title: 'Invoice INV-9 created', link: '/invoices/inv1', linkLabel: 'Open invoice', actorName: 'Basit' });
    expect(sent['message']).toBe('INV-9 for North Maple Foods, CAD 1,500.00');
    const details = JSON.parse(sent['details'] as string) as Array<{ label: string; value: string }>;
    expect(details).toEqual(expect.arrayContaining([
      { label: 'Invoice No', value: 'INV-9' }, { label: 'Importer', value: 'North Maple Foods' },
      { label: 'Invoice Date', value: '2026-09-15' }, { label: 'Total', value: 'CAD 1,500.00' },
    ]));
  });

  it('points a deleted invoice to the Recycle Bin as a warning', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(invoice as never);
    await events.invoiceDeleted('Basit', 'inv1');
    expect(lastSent()).toMatchObject({ type: 'warning', title: 'Invoice INV-9 deleted', link: '/recycle-bin', linkLabel: 'Open Recycle Bin' });
  });

  it('records a manual exchange rate under the currency category', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(invoice as never);
    await events.invoiceRateSet('Basit', 'inv1', 0.2723, 'USD');
    expect(lastSent()).toMatchObject({ category: 'currency', title: 'Exchange rate set for INV-9' });
  });

  it('says nothing if the record no longer exists', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(null);
    await events.invoiceCreated('Basit', 'gone');
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
  });

  it('describes an importer being marked not needed, and being activated again', async () => {
    prismaMock.importer.findUnique.mockResolvedValue({
      id: 'i1', name: 'ABC', currency: 'USD', buyerName: null, contact: null, email: null, isActive: false, landingLocations: [1, 2], loadingLocations: [1],
    } as never);
    await events.importerActiveChanged('Basit', 'i1', false);
    expect(lastSent()).toMatchObject({ type: 'info', category: 'importer', title: 'Importer ABC marked as not needed', link: '/importers' });
    await events.importerActiveChanged('Basit', 'i1', true);
    expect(lastSent()).toMatchObject({ type: 'success', title: 'Importer ABC is active again' });
  });

  it('reports a permanent delete using the label read beforehand', async () => {
    await events.recordPermanentlyDeleted('Basit', 'invoice', 'INV-7');
    expect(lastSent()).toMatchObject({ type: 'warning', title: 'Invoice INV-7 permanently deleted' });
    prismaMock.notification.createMany.mockClear();
    await events.recordPermanentlyDeleted('Basit', 'importer', null);
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
  });

  it('announces a new reporting currency', async () => {
    await events.baseCurrencyChanged('Basit', 'USD');
    expect(lastSent()).toMatchObject({ category: 'currency', title: 'Reporting currency changed to USD' });
  });
});

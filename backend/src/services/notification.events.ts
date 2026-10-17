import type { Request } from 'express';
import { prisma } from '../lib/prisma';
import { notificationService, type NewNotification } from './notification.service';
import type { NotificationDetail } from 'shared';

/** Who did it, for the "by …" line on a notification. */
export const actorOf = (req: Request): string | null => req.auth?.user.displayName ?? req.auth?.user.username ?? null;

const money = (amount: unknown, currency: string) =>
  `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: Date) => d.toISOString().slice(0, 10);

const send = (actor: string | null, n: NewNotification) => notificationService.notifyAll(actor, n);

interface InvoiceFacts {
  number: string;
  importer: string;
  summary: string;
  details: NotificationDetail[];
}

async function invoiceFacts(id: string): Promise<InvoiceFacts | null> {
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { importer: { select: { name: true } } } });
  if (!inv) return null;
  const importerName = inv.importerName ?? inv.importer.name; // the invoice's own copy
  return {
    number: inv.invoiceNumber,
    importer: importerName,
    summary: `${inv.invoiceNumber} for ${importerName}, ${money(inv.total, inv.currency)}`,
    details: [
      { label: 'Invoice No', value: inv.invoiceNumber },
      { label: 'Importer', value: importerName },
      { label: 'Invoice Date', value: day(inv.invoiceDate) },
      { label: 'Total', value: money(inv.total, inv.currency) },
      { label: 'Boxes', value: String(inv.totalBoxes) },
    ],
  };
}

const openInvoice = (id: string) => ({ link: `/invoices/${id}`, linkLabel: 'Open invoice' });
const openBin = { link: '/recycle-bin', linkLabel: 'Open Recycle Bin' };
const openImporters = { link: '/importers', linkLabel: 'Open importers' };

export const events = {
  async invoiceCreated(actor: string | null, id: string) {
    const f = await invoiceFacts(id);
    if (!f) return;
    await send(actor, { type: 'success', category: 'invoice', title: `Invoice ${f.number} created`, message: f.summary, details: f.details, ...openInvoice(id) });
  },

  async invoiceUpdated(actor: string | null, id: string) {
    const f = await invoiceFacts(id);
    if (!f) return;
    await send(actor, { type: 'info', category: 'invoice', title: `Invoice ${f.number} updated`, message: f.summary, details: f.details, ...openInvoice(id) });
  },

  async invoiceDeleted(actor: string | null, id: string) {
    const f = await invoiceFacts(id);
    if (!f) return;
    await send(actor, {
      type: 'warning', category: 'invoice', title: `Invoice ${f.number} deleted`,
      message: `${f.summary}. It was moved to the Recycle Bin and can be restored.`, details: f.details, ...openBin,
    });
  },

  async invoiceRestored(actor: string | null, id: string) {
    const f = await invoiceFacts(id);
    if (!f) return;
    await send(actor, { type: 'success', category: 'invoice', title: `Invoice ${f.number} restored`, message: f.summary, details: f.details, ...openInvoice(id) });
  },

  async invoiceRateSet(actor: string | null, id: string, rate: number, base: string) {
    const f = await invoiceFacts(id);
    if (!f) return;
    await send(actor, {
      type: 'info', category: 'currency', title: `Exchange rate set for ${f.number}`,
      message: `${f.number} will now count in revenue at 1 unit = ${rate} ${base}.`,
      details: [...f.details, { label: 'Rate entered', value: `${rate} ${base}` }], ...openInvoice(id),
    });
  },

  async invoiceRateCleared(actor: string | null, id: string) {
    const f = await invoiceFacts(id);
    if (!f) return;
    await send(actor, {
      type: 'info', category: 'currency', title: `Exchange rate removed from ${f.number}`,
      message: 'The manual rate was removed, so the invoice uses an automatic rate again, or is left out of revenue if none exists.',
      details: f.details, ...openInvoice(id),
    });
  },

  async baseCurrencyChanged(actor: string | null, to: string) {
    await send(actor, {
      type: 'info', category: 'currency', title: `Reporting currency changed to ${to}`,
      message: `The dashboard and invoice totals are now reported in ${to}. Manual exchange rates entered for another currency need to be entered again.`,
      details: [{ label: 'Reporting currency', value: to }],
    });
  },

  async importerCreated(actor: string | null, id: string) {
    const i = await prisma.importer.findUnique({ where: { id }, include: { landingLocations: true, loadingLocations: true } });
    if (!i) return;
    await send(actor, {
      type: 'success', category: 'importer', title: `Importer ${i.name} created`,
      message: `${i.name} (${i.currency}) can now be selected when creating invoices.`,
      details: importerDetails(i), ...openImporters,
    });
  },

  async importerUpdated(actor: string | null, id: string) {
    const i = await prisma.importer.findUnique({ where: { id }, include: { landingLocations: true, loadingLocations: true } });
    if (!i) return;
    await send(actor, {
      type: 'info', category: 'importer', title: `Importer ${i.name} updated`,
      message: 'The importer details were changed. Invoices already created keep the values they were created with.',
      details: importerDetails(i), ...openImporters,
    });
  },

  async importerActiveChanged(actor: string | null, id: string, isActive: boolean) {
    const i = await prisma.importer.findUnique({ where: { id }, include: { landingLocations: true, loadingLocations: true } });
    if (!i) return;
    await send(actor, {
      type: isActive ? 'success' : 'info', category: 'importer',
      title: isActive ? `Importer ${i.name} is active again` : `Importer ${i.name} marked as not needed`,
      message: isActive
        ? `${i.name} can be selected when creating invoices again.`
        : `${i.name} stays in the importers list but no longer appears when creating invoices.`,
      details: importerDetails(i), ...openImporters,
    });
  },

  async importerDeleted(actor: string | null, id: string) {
    const i = await prisma.importer.findUnique({ where: { id }, include: { landingLocations: true, loadingLocations: true } });
    if (!i) return;
    await send(actor, {
      type: 'warning', category: 'importer', title: `Importer ${i.name} deleted`,
      message: `${i.name} was moved to the Recycle Bin and can be restored. Existing invoices are not changed.`,
      details: importerDetails(i), ...openBin,
    });
  },

  async importerRestored(actor: string | null, id: string) {
    const i = await prisma.importer.findUnique({ where: { id }, include: { landingLocations: true, loadingLocations: true } });
    if (!i) return;
    await send(actor, { type: 'success', category: 'importer', title: `Importer ${i.name} restored`, message: `${i.name} is back in the importers list.`, details: importerDetails(i), ...openImporters });
  },

  /** Read before a permanent delete (the row is gone afterwards); pass the result to recordPermanentlyDeleted. */
  async snapshotRecord(type: 'invoice' | 'importer', id: string): Promise<string | null> {
    if (type === 'invoice') return (await prisma.invoice.findUnique({ where: { id }, select: { invoiceNumber: true } }))?.invoiceNumber ?? null;
    return (await prisma.importer.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
  },

  async recordPermanentlyDeleted(actor: string | null, type: 'invoice' | 'importer', label: string | null) {
    if (!label) return;
    await send(actor, {
      type: 'warning', category: type, title: `${type === 'invoice' ? 'Invoice' : 'Importer'} ${label} permanently deleted`,
      message: 'It was removed for good and cannot be restored.', details: [{ label: type === 'invoice' ? 'Invoice No' : 'Name', value: label }],
    });
  },
};

function importerDetails(i: {
  name: string; currency: string; buyerName: string | null; contact: string | null; email: string | null; isActive: boolean;
  landingLocations: unknown[]; loadingLocations: unknown[];
}): NotificationDetail[] {
  const out: NotificationDetail[] = [
    { label: 'Name', value: i.name },
    { label: 'Currency', value: i.currency },
    { label: 'Status', value: i.isActive ? 'Active' : 'Not needed' },
  ];
  if (i.buyerName) out.push({ label: 'Buyer', value: i.buyerName });
  if (i.contact) out.push({ label: 'Contact', value: i.contact });
  if (i.email) out.push({ label: 'Email', value: i.email });
  out.push({ label: 'Landing locations', value: String(i.landingLocations.length) });
  out.push({ label: 'Loading locations', value: String(i.loadingLocations.length) });
  return out;
}

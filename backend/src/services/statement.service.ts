import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { money, summaryOf } from './payment.service';
import type { Statement, StatementInvoice, StatementQuery, StatementRow, StatementSection } from 'shared';

const isoOf = (date: Date) => date.toISOString().slice(0, 10);
const num = (value: { toString(): string } | null | undefined) => (value === null || value === undefined ? 0 : Number(value));

/** The number printed on an actual invoice: that of the invoice it was made from. */
const numberOf = (inv: { invoiceNumber: string; printedNumber: string | null; actualOf: { invoiceNumber: string } | null }) => inv.printedNumber || inv.actualOf?.invoiceNumber || inv.invoiceNumber;

export const statementService = {
  /**
   * What an importer owes: for each currency, the opening balance before the period, then every actual invoice (owed) and
   * every payment received (paid) in date order with a running balance, and the balance at the end.
   * Without dates it covers everything. Invoices and payments before `from` are rolled into the opening balance.
   */
  async build(importerId: string, query: StatementQuery): Promise<Statement> {
    const importer = await prisma.importer.findUnique({ where: { id: importerId }, select: { id: true, name: true, address: true, contact: true, email: true } });
    if (!importer) throw new AppError('Importer not found', 404, 'IMPORTER_NOT_FOUND');

    const invoices = await prisma.invoice.findMany({
      where: { importerId, deletedAt: null, isCompanion: false, actualOfId: { not: null } },
      select: { id: true, invoiceNumber: true, printedNumber: true, actualOf: { select: { invoiceNumber: true } }, invoiceDate: true, currency: true, total: true, createdAt: true, payments: { select: { id: true, paidOn: true, amount: true, method: true, reference: true, createdAt: true } } },
      orderBy: [{ invoiceDate: 'asc' }, { createdAt: 'asc' }],
    });

    const from = query.from ?? null;
    const to = query.to ?? null;
    const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);
    const before = (date: string) => Boolean(from) && date < from!;
    const after = (date: string) => Boolean(to) && date > to!;

    const byCurrency = new Map<string, typeof invoices>();
    for (const inv of invoices) byCurrency.set(inv.currency, [...(byCurrency.get(inv.currency) ?? []), inv]);

    const sections: StatementSection[] = [];
    for (const [currency, list] of [...byCurrency.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      interface Event { date: string; order: number; at: number; row: Omit<StatementRow, 'balance'> }
      const events: Event[] = [];
      for (const inv of list) {
        const number = numberOf(inv);
        events.push({ date: isoOf(inv.invoiceDate), order: 0, at: inv.createdAt.getTime(), row: { date: isoOf(inv.invoiceDate), kind: 'invoice', reference: number, description: 'Invoice', debit: money(num(inv.total)), credit: 0 } });
        for (const p of inv.payments) {
          const parts = ['Payment received', p.method, p.reference ? `Ref ${p.reference}` : null].filter(Boolean);
          events.push({ date: isoOf(p.paidOn), order: 1, at: p.createdAt.getTime(), row: { date: isoOf(p.paidOn), kind: 'payment', reference: number, description: parts.join(' · '), debit: 0, credit: money(num(p.amount)) } });
        }
      }
      events.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.at - b.at);

      let balance = money(events.filter((e) => before(e.date)).reduce((sum, e) => sum + e.row.debit - e.row.credit, 0));
      const opening = balance;
      const rows: StatementRow[] = [];
      let invoiced = 0;
      let received = 0;
      for (const e of events.filter((x) => inRange(x.date))) {
        balance = money(balance + e.row.debit - e.row.credit);
        invoiced += e.row.debit;
        received += e.row.credit;
        rows.push({ ...e.row, balance });
      }

      // the invoices of the period, and older ones still owing, with what has been paid on each by the end of the period
      const invoiceList: StatementInvoice[] = [];
      for (const inv of list) {
        const date = isoOf(inv.invoiceDate);
        if (after(date)) continue;
        const paid = inv.payments.filter((p) => !after(isoOf(p.paidOn))).reduce((sum, p) => sum + num(p.amount), 0);
        const summary = summaryOf(num(inv.total), paid);
        if (!inRange(date) && summary.balance <= 0) continue;
        invoiceList.push({ invoiceId: inv.id, number: numberOf(inv), date, total: summary.total, paid: summary.paid, balance: summary.balance, status: summary.status });
      }

      if (rows.length === 0 && opening === 0 && invoiceList.length === 0) continue;
      sections.push({ currency, opening, invoiced: money(invoiced), received: money(received), closing: balance, rows, invoices: invoiceList });
    }

    return {
      importer: { id: importer.id, name: importer.name, address: importer.address ?? null, contact: importer.contact ?? null, email: importer.email ?? null },
      from, to, generatedOn: isoOf(new Date()), sections,
    };
  },
};

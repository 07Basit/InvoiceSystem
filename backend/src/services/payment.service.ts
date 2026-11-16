import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import type { InvoicePayments, PaymentDto, PaymentRecord, PaymentStatus, PaymentSummary } from 'shared';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const isoOf = (date: Date) => date.toISOString().slice(0, 10);
export const money = (n: number) => Math.round(n * 100) / 100;
const num = (value: { toString(): string } | null | undefined) => (value === null || value === undefined ? 0 : Number(value));

/** Under half a paisa either way counts as paid in full. */
const SETTLED = 0.005;

/** How much of an invoice total has been paid: nothing, part, all, or more than all. */
export function summaryOf(total: number, paid: number): PaymentSummary {
  const t = money(total);
  const p = money(paid);
  const balance = money(t - p);
  const status: PaymentStatus = p <= 0 ? 'unpaid' : balance > SETTLED ? 'partial' : balance < -SETTLED ? 'overpaid' : 'paid';
  return { total: t, paid: p, balance, status };
}

type PaymentRow = { id: string; invoiceId: string; paidOn: Date; amount: { toString(): string }; method: string | null; reference: string | null; notes: string | null; createdAt: Date };

function present(p: PaymentRow): PaymentRecord {
  return { id: p.id, invoiceId: p.invoiceId, paidOn: isoOf(p.paidOn), amount: num(p.amount), method: p.method, reference: p.reference, notes: p.notes, createdAt: p.createdAt.toISOString() };
}

const clean = (dto: PaymentDto) => ({
  paidOn: day(dto.paidOn),
  amount: dto.amount,
  method: dto.method?.trim() || null,
  reference: dto.reference?.trim() || null,
  notes: dto.notes?.trim() || null,
});

export const paymentService = {
  /** Payments are recorded on the actual invoice, which is the amount the importer really owes. */
  async assertActual(invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, deletedAt: null }, select: { id: true, total: true, currency: true, actualOfId: true } });
    if (!invoice) throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    if (!invoice.actualOfId) throw new AppError('Payments are recorded on the actual invoice. Open the actual invoice of this one.', 400, 'PAYMENT_NOT_ACTUAL');
    return invoice;
  },

  async forInvoice(invoiceId: string): Promise<InvoicePayments> {
    const invoice = await this.assertActual(invoiceId);
    const payments = await prisma.payment.findMany({ where: { invoiceId }, orderBy: [{ paidOn: 'asc' }, { createdAt: 'asc' }] });
    return { invoiceId, currency: invoice.currency, payments: payments.map(present), summary: summaryOf(num(invoice.total), payments.reduce((sum, p) => sum + num(p.amount), 0)) };
  },

  async create(invoiceId: string, dto: PaymentDto): Promise<InvoicePayments> {
    await this.assertActual(invoiceId);
    await prisma.payment.create({ data: { invoiceId, ...clean(dto) } });
    return this.forInvoice(invoiceId);
  },

  async update(paymentId: string, dto: PaymentDto): Promise<InvoicePayments> {
    const existing = await prisma.payment.findUnique({ where: { id: paymentId }, select: { invoiceId: true } });
    if (!existing) throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    await prisma.payment.update({ where: { id: paymentId }, data: clean(dto) });
    return this.forInvoice(existing.invoiceId);
  },

  async remove(paymentId: string): Promise<InvoicePayments> {
    const existing = await prisma.payment.findUnique({ where: { id: paymentId }, select: { invoiceId: true } });
    if (!existing) throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    await prisma.payment.delete({ where: { id: paymentId } });
    return this.forInvoice(existing.invoiceId);
  },

  /** Every payment method used so far (most used first), so a method that was typed once is offered again. */
  async methods(): Promise<string[]> {
    const groups = await prisma.payment.groupBy({ by: ['method'], where: { method: { not: null } }, _count: { _all: true } });
    const merged = new Map<string, { name: string; count: number }>();
    for (const g of groups) {
      const name = g.method?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = merged.get(key) ?? { name, count: 0 };
      // "cheque" and "Cheque" are one method: keep the spelling used most
      if (g._count._all > entry.count && entry.count > 0) entry.name = name;
      entry.count += g._count._all;
      merged.set(key, entry);
    }
    return [...merged.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).map((m) => m.name);
  },

  /** The payment summary of each of these invoices (for the invoice list). Only actual invoices have one. */
  async summaries(invoices: { id: string; total: unknown; actualOfId: string | null }[]): Promise<Map<string, PaymentSummary>> {
    const actual = invoices.filter((inv) => inv.actualOfId);
    const out = new Map<string, PaymentSummary>();
    if (actual.length === 0) return out;
    const sums = await prisma.payment.groupBy({ by: ['invoiceId'], where: { invoiceId: { in: actual.map((inv) => inv.id) } }, _sum: { amount: true } });
    const paid = new Map(sums.map((s) => [s.invoiceId, num(s._sum.amount)]));
    for (const inv of actual) out.set(inv.id, summaryOf(num(inv.total as never), paid.get(inv.id) ?? 0));
    return out;
  },
};

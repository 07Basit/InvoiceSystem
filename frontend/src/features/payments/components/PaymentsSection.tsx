import { useState } from 'react';
import { FileText, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import type { PaymentDto, PaymentRecord } from 'shared';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useConfirm } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useInvoicePayments, usePaymentMutations } from '../hooks/usePayments';
import PaymentDialog from './PaymentDialog';
import PaymentStatusBadge from './PaymentStatusBadge';
import StatementDialog from './StatementDialog';

const Tile: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone }) => (
  <div className="rounded-lg bg-muted/40 p-3">
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={cn('mt-0.5 text-lg font-bold tabular-nums', tone)}>{value}</p>
  </div>
);

/** The payments received against an actual invoice, and how much is still due. */
/** `importer` is whose statement the Statement button opens. */
const PaymentsSection: React.FC<{ invoiceId: string; importer?: { id: string; name: string } }> = ({ invoiceId, importer }) => {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { data, isLoading, isError, refetch } = useInvoicePayments(invoiceId);
  const { create, update, remove } = usePaymentMutations(invoiceId);
  const [editing, setEditing] = useState<PaymentRecord | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);

  const close = () => { setEditing(null); setError(null); };
  const save = (dto: PaymentDto) => {
    setError(null);
    const done = () => { showToast('Payment saved', editing === 'new' ? 'The payment was recorded.' : 'The payment was changed.', 'success'); close(); };
    if (editing === 'new') create.mutate(dto, { onSuccess: done, onError: (e) => setError(e.message) });
    else if (editing) update.mutate({ id: editing.id, dto }, { onSuccess: done, onError: (e) => setError(e.message) });
  };
  const onDelete = async (p: PaymentRecord) => {
    const ok = await confirm({ title: 'Delete this payment?', message: `${formatCurrency(p.amount, data?.currency ?? '')} received on ${formatDate(p.paidOn)} is removed from this invoice. This cannot be undone.`, confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    remove.mutate(p.id, { onSuccess: () => showToast('Payment deleted', 'The payment was removed.', 'success'), onError: (e) => showToast('Could not delete', e.message, 'error') });
  };

  const cur = data?.currency ?? '';
  const summary = data?.summary;

  return (
    <section className="rounded-xl border bg-card" aria-label="Payments received">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Wallet className="h-4 w-4 text-muted-foreground" /> Payments received {summary && <PaymentStatusBadge summary={summary} />}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {importer && <button type="button" onClick={() => setStatementOpen(true)} className="btn-ghost !px-3 !py-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Statement</button>}
          <button type="button" onClick={() => setEditing('new')} disabled={!data} className="btn-brand !px-3 !py-1.5 text-xs disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Record payment</button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-10"><LoadingSpinner variant="invoices" size="sm" /></div>
      ) : isError || !data || !summary ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">The payments could not be loaded.</p>
          <button type="button" onClick={() => void refetch()} className="btn-ghost mt-3">Try again</button>
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile label="Invoice total" value={formatCurrency(summary.total, cur)} />
            <Tile label="Received" value={formatCurrency(summary.paid, cur)} tone="text-emerald-700" />
            <Tile label={summary.balance < 0 ? 'Overpaid by' : 'Balance due'} value={formatCurrency(Math.abs(summary.balance), cur)} tone={summary.balance > 0.005 ? 'text-red-700' : summary.balance < -0.005 ? 'text-sky-700' : 'text-emerald-700'} />
          </div>

          {data.payments.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No payment has been recorded against this invoice yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 font-medium">Reference</th>
                    <th className="px-3 py-2 font-medium">Notes</th>
                    <th className="w-20 px-3 py-2" aria-hidden="true" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDate(p.paidOn)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(p.amount, cur)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{p.method || '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{p.reference || '—'}</td>
                      <td className="max-w-[14rem] truncate px-3 py-2.5 text-muted-foreground" title={p.notes ?? ''}>{p.notes || '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => setEditing(p)} className="btn-icon" aria-label={`Change payment of ${formatDate(p.paidOn)}`} title="Change"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => void onDelete(p)} className="btn-icon hover:text-destructive" aria-label={`Delete payment of ${formatDate(p.paidOn)}`} title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {statementOpen && importer && <StatementDialog importerId={importer.id} importerName={importer.name} onClose={() => setStatementOpen(false)} />}
      {editing && data && <PaymentDialog currency={cur} balance={data.summary.balance} payment={editing === 'new' ? null : editing} busy={create.isPending || update.isPending} error={error} onSave={save} onClose={close} />}
    </section>
  );
};

export default PaymentsSection;

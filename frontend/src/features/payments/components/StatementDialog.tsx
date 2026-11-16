import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react';
import DatePicker from '@/components/ui/DatePicker';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/toast';
import { QUICK_DATES, activeQuickDate, quickRange } from '@/features/invoices/utils/invoiceFilters';
import { cn, formatCurrency } from '@/lib/utils';
import { useStatement } from '../hooks/usePayments';
import { paymentService } from '../services/paymentService';

interface StatementDialogProps {
  importerId: string;
  importerName: string;
  onClose: () => void;
}

const chip = (active: boolean) => cn('rounded-full border px-3 py-1.5 text-xs transition-colors', active ? 'border-[hsl(var(--brand-accent))]/60 bg-[hsl(var(--brand-accent))]/10 font-semibold text-[hsl(var(--brand-accent))]' : 'bg-background hover:bg-accent');

/** An importer's statement of account: choose the dates, see where it stands, download it as a PDF or an Excel file. */
const StatementDialog: React.FC<StatementDialogProps> = ({ importerId, importerName, onClose }) => {
  const { showToast } = useToast();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null);
  const query = { ...(dateFrom ? { from: dateFrom } : {}), ...(dateTo ? { to: dateTo } : {}) };
  const { data: statement, isLoading, isError } = useStatement(importerId, query);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const quick = activeQuickDate({ dateFrom, dateTo }, new Date());
  const download = async (kind: 'pdf' | 'excel') => {
    setBusy(kind);
    try {
      await (kind === 'pdf' ? paymentService.downloadStatementPdf(importerId, query) : paymentService.downloadStatementExcel(importerId, query));
    } catch (error) {
      showToast('Could not download the statement', error instanceof Error ? error.message : 'Please try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Statement of account">
      <div className="my-8 w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Statement of account</h2>
            <p className="text-sm text-muted-foreground">{importerName}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon -mr-2 -mt-1" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick dates">
            <button type="button" aria-pressed={!dateFrom && !dateTo} onClick={() => { setDateFrom(''); setDateTo(''); }} className={chip(!dateFrom && !dateTo)}>All dates</button>
            {QUICK_DATES.map(({ id, label }) => (
              <button key={id} type="button" aria-pressed={quick === id} onClick={() => { const r = quickRange(id, new Date()); setDateFrom(r.dateFrom); setDateTo(r.dateTo); }} className={chip(quick === id)}>{label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">From</label><DatePicker ariaLabel="Statement from" value={dateFrom} onChange={setDateFrom} placeholder="Any" /></div>
            <div><label className="label">To</label><DatePicker ariaLabel="Statement to" value={dateTo} onChange={setDateTo} placeholder="Any" /></div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border bg-card p-4" aria-live="polite">
          {isLoading ? (
            <div className="py-6"><LoadingSpinner variant="invoices" size="sm" /></div>
          ) : isError || !statement ? (
            <p className="py-4 text-center text-sm text-muted-foreground">The statement could not be loaded.</p>
          ) : statement.sections.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No actual invoices or payments in this period.</p>
          ) : (
            <div className="space-y-4">
              {statement.sections.map((s) => (
                <div key={s.currency}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account in {s.currency}</p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Brought forward</dt><dd className="text-right tabular-nums">{formatCurrency(s.opening, s.currency)}</dd>
                    <dt className="text-muted-foreground">Invoiced</dt><dd className="text-right tabular-nums">{formatCurrency(s.invoiced, s.currency)}</dd>
                    <dt className="text-muted-foreground">Received</dt><dd className="text-right tabular-nums text-emerald-700">{formatCurrency(s.received, s.currency)}</dd>
                    <dt className="border-t pt-1 font-semibold">Balance due</dt><dd className={cn('border-t pt-1 text-right font-bold tabular-nums', s.closing > 0.005 ? 'text-red-700' : 'text-emerald-700')}>{formatCurrency(s.closing, s.currency)}</dd>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">The statement covers this importer’s actual invoices and the payments recorded against them.</p>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => void download('excel')} disabled={busy !== null || isLoading} className="btn-ghost disabled:opacity-50"><FileSpreadsheet className="h-4 w-4" /> {busy === 'excel' ? 'Preparing…' : 'Download Excel'}</button>
          <button type="button" onClick={() => void download('pdf')} disabled={busy !== null || isLoading} className="btn-brand disabled:opacity-50">{busy === 'pdf' ? <Download className="h-4 w-4" /> : <FileText className="h-4 w-4" />} {busy === 'pdf' ? 'Preparing…' : 'Download PDF'}</button>
        </div>
      </div>
    </div>
  );
};

export default StatementDialog;

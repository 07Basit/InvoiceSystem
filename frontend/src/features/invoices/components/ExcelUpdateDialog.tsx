import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Loader2, UploadCloud, X } from 'lucide-react';
import type { ExcelLineStatus, ExcelPagePreview, ExcelUpdatePreview } from 'shared';
import { useToast } from '@/components/ui/toast';
import { cn, formatCurrency } from '@/lib/utils';
import { formatNumber } from '@/lib/format';
import { useApplyExcelUpdate, useExcelUpdatePreview } from '../hooks/useExcelUpdate';

interface ExcelUpdateDialogProps {
  invoiceId: string;
  invoiceNumber: string;
  onClose: () => void;
}

const STATUS: Record<ExcelLineStatus, { label: string; row: string; chip: string }> = {
  added: { label: 'Added', row: 'bg-emerald-50/60', chip: 'bg-emerald-100 text-emerald-800' },
  changed: { label: 'Changed', row: 'bg-amber-50/60', chip: 'bg-amber-100 text-amber-800' },
  unchanged: { label: 'Same', row: '', chip: 'bg-secondary text-muted-foreground' },
};

const isExcel = (file: File) => /\.xlsx$/i.test(file.name);

const Count: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => (
  <div className={cn('rounded-lg border px-3 py-2 text-center', value > 0 ? tone : 'bg-card text-muted-foreground')}>
    <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
    <p className="text-[11px] font-medium uppercase tracking-wide">{label}</p>
  </div>
);

const pageChanges = (page: ExcelPagePreview) => page.counts.added + page.counts.changed + page.counts.removed;

/** One page of the invoice: what was added, changed and removed, every line, and the totals before and after. */
const PageReview: React.FC<{ page: ExcelPagePreview; currency: string; balance?: ExcelUpdatePreview['payments'] }> = ({ page, currency, balance }) => {
  const money = (n: number) => formatCurrency(n, currency);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Count label="Added" value={page.counts.added} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
        <Count label="Changed" value={page.counts.changed} tone="border-amber-200 bg-amber-50 text-amber-800" />
        <Count label="Removed" value={page.counts.removed} tone="border-red-200 bg-red-50 text-red-800" />
        <Count label="Same" value={page.counts.unchanged} tone="bg-card" />
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Row</th><th className="px-3 py-2 font-semibold">Product line</th>
              <th className="px-3 py-2 text-right font-semibold">Nett wt / pkg</th><th className="px-3 py-2 text-right font-semibold">Boxes</th>
              <th className="px-3 py-2 text-right font-semibold">Rate / kg</th><th className="px-3 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {page.lines.map((l) => (
              <tr key={l.row} className={cn('border-b align-top last:border-0', STATUS[l.status].row)}>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{l.row}</td>
                <td className="px-3 py-2">
                  <span className="font-medium">{l.input.descriptionOfGoods || <span className="text-muted-foreground">(no description)</span>}</span>{' '}
                  <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', STATUS[l.status].chip)}>{STATUS[l.status].label}</span>
                  {l.changes.map((c) => <p key={c.field} className="text-xs text-amber-800">{c.label}: <span className="line-through opacity-70">{c.before || '—'}</span> → <span className="font-semibold">{c.after || '—'}</span></p>)}
                  {l.problems.map((p) => <p key={p} className="text-xs font-medium text-red-700">{p}</p>)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{l.problems.length ? '—' : formatNumber(l.input.netWeightPerPackage)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{l.problems.length ? '—' : l.input.numberOfBoxes}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{l.problems.length ? '—' : money(l.input.ratePerKg)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{l.problems.length ? '—' : money(l.amount)}</td>
              </tr>
            ))}
            {page.removed.map((r) => (
              <tr key={r.id} className="border-b bg-red-50/60 last:border-0">
                <td className="px-3 py-2 text-muted-foreground">—</td>
                <td className="px-3 py-2"><span className="font-medium line-through opacity-70">{r.descriptionOfGoods}</span> <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-800">Removed</span></td>
                <td /><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums line-through opacity-70">{r.numberOfBoxes}</td><td />
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums line-through opacity-70">{money(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2">
        {([['Boxes', String(page.totals.before.boxes), String(page.totals.after.boxes)], ['Total nett weight', `${formatNumber(page.totals.before.netWeight)} KGS`, `${formatNumber(page.totals.after.netWeight)} KGS`], ['Sub total', money(page.totals.before.subTotal), money(page.totals.after.subTotal)], ['Invoice total', money(page.totals.before.total), money(page.totals.after.total)]] as const).map(([label, before, after]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular-nums">{before === after ? <span className="font-medium">{after}</span> : <><span className="opacity-60 line-through">{before}</span> → <span className="font-bold">{after}</span></>}</span>
          </div>
        ))}
        {balance && (
          <div className="flex items-baseline justify-between gap-3 border-t pt-2 sm:col-span-2">
            <span className="text-muted-foreground">Balance due (payments received {money(balance.paid)})</span>
            <span className="tabular-nums"><span className="opacity-60 line-through">{money(balance.balanceBefore)}</span> → <span className="font-bold">{money(balance.balanceAfter)}</span></span>
          </div>
        )}
      </div>
    </div>
  );
};

/** Update an invoice's product lines from its edited Excel: choose the file, check what would change, approve. */
const ExcelUpdateDialog: React.FC<ExcelUpdateDialogProps> = ({ invoiceId, invoiceNumber, onClose }) => {
  const { showToast } = useToast();
  const preview = useExcelUpdatePreview(invoiceId);
  const apply = useApplyExcelUpdate(invoiceId);
  const [result, setResult] = useState<ExcelUpdatePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<'party' | 'custom'>('party');
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const read = (file: File | undefined) => {
    if (!file) return;
    if (!isExcel(file)) { setError('Choose the Excel you downloaded from this invoice (a .xlsx file).'); return; }
    setError(null);
    preview.mutate(file, { onSuccess: (r) => { setResult(r); setTab('party'); }, onError: (e) => setError(e.message) });
  };

  const approve = () => {
    if (!result) return;
    setError(null);
    apply.mutate(
      { lines: result.lines.map((l) => l.input), ...(result.custom ? { customLines: result.custom.lines.map((l) => l.input) } : {}), invoiceVersion: result.invoiceVersion, fileName: result.fileName },
      {
        onSuccess: () => { showToast('Invoice updated', 'The product lines now match your Excel. You can undo this from the invoice page.', 'success'); onClose(); },
        onError: (e) => setError(e.message),
      },
    );
  };

  const cur = result?.currency ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Update from Excel">
      <div className="my-6 w-full max-w-4xl rounded-2xl border border-border bg-background p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Update from Excel</h2>
            <p className="text-sm text-muted-foreground">Invoice {invoiceNumber}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon -mr-2 -mt-1" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        {!result ? (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Download the Excel of this invoice, then add, delete or change rows of the product table and save it.</li>
              <li>Choose that file here. You see exactly what would change before anything is saved.</li>
            </ol>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); read(e.dataTransfer.files[0]); }}
              className={cn('flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors', dragging ? 'border-primary bg-primary/5' : 'border-border')}
            >
              {preview.isPending ? (
                <><Loader2 className="mb-3 h-8 w-8 animate-spin text-muted-foreground" /><p className="text-sm font-medium">Reading the file…</p></>
              ) : (
                <>
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><FileSpreadsheet className="h-6 w-6" /></span>
                  <p className="text-sm font-medium">Drop the edited Excel here</p>
                  <p className="mt-1 text-xs text-muted-foreground">.xlsx, up to 10 MB</p>
                  <button type="button" onClick={() => picker.current?.click()} className="btn-brand mt-4"><UploadCloud className="h-4 w-4" /> Choose a file</button>
                </>
              )}
              <input ref={picker} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" aria-label="Choose the edited Excel" onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="flex min-w-0 items-center gap-2 text-muted-foreground"><FileSpreadsheet className="h-4 w-4 shrink-0" /><span className="truncate">{result.fileName}</span></p>
              <button type="button" onClick={() => { setResult(null); setError(null); }} className="text-xs font-medium text-primary hover:underline">Choose another file</button>
            </div>

            {result.blockers.map((b) => <p key={b} role="alert" className="flex gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{b}</p>)}
            {result.warnings.map((w) => <p key={w} className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}</p>)}

            {result.custom && (
              <div role="tablist" aria-label="Page" className="flex gap-1.5">
                {([['party', 'Party page', result.counts.added + result.counts.changed + result.counts.removed], ['custom', 'Custom page', pageChanges(result.custom)]] as const).map(([id, label, changes]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                    className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors', tab === id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground')}>
                    {label} <span className={cn('ml-1 text-xs tabular-nums', tab === id ? 'opacity-80' : 'opacity-60')}>{changes === 0 ? 'no changes' : `${changes} change${changes === 1 ? '' : 's'}`}</span>
                  </button>
                ))}
              </div>
            )}

            {!result.canApply && result.blockers.length === 0 && result.lines.every((l) => l.problems.length === 0) && (result.custom?.lines ?? []).every((l) => l.problems.length === 0) && (
              <p className="rounded-lg border bg-secondary/50 p-3 text-center text-sm text-muted-foreground">No changes found in this file. The invoice already matches it.</p>
            )}

            {result.custom && tab === 'custom' ? (
              <PageReview page={result.custom} currency={cur} />
            ) : (
              <PageReview page={result} currency={cur} balance={result.payments} />
            )}

            {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
              <button type="button" onClick={approve} disabled={!result.canApply || apply.isPending} className="btn-brand disabled:opacity-50">{apply.isPending ? 'Updating…' : 'Approve and update the invoice'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelUpdateDialog;

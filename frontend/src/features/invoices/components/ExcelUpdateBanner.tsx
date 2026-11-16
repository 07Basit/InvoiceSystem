import { FileSpreadsheet, Undo2 } from 'lucide-react';
import { useConfirm } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import { useLatestExcelUpdate, useUndoExcelUpdate } from '../hooks/useExcelUpdate';

/** Shown for as long as the last update from Excel can still be undone, which is until the invoice is changed again. */
const ExcelUpdateBanner: React.FC<{ invoiceId: string }> = ({ invoiceId }) => {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { data: update } = useLatestExcelUpdate(invoiceId);
  const undo = useUndoExcelUpdate(invoiceId);
  if (!update || !update.canUndo) return null;

  const onUndo = async () => {
    const ok = await confirm({ title: 'Undo the update from Excel?', message: 'The product lines go back to how they were before the update.', confirmLabel: 'Undo update' });
    if (!ok) return;
    undo.mutate(undefined, {
      onSuccess: () => showToast('Update undone', 'The product lines are back as they were.', 'success'),
      onError: (e) => showToast('Could not undo', e.message, 'error'),
    });
  };
  const parts = [update.added ? `${update.added} added` : '', update.changed ? `${update.changed} changed` : '', update.removed ? `${update.removed} removed` : ''].filter(Boolean);

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 print:hidden">
      <span className="flex min-w-0 items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 shrink-0" />
        <span className="truncate">Product lines were updated from Excel on {formatDate(update.createdAt)}{parts.length ? ` (${parts.join(', ')})` : ''}.</span>
      </span>
      <button type="button" onClick={() => void onUndo()} disabled={undo.isPending} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50"><Undo2 className="h-3.5 w-3.5" /> Undo</button>
    </div>
  );
};

export default ExcelUpdateBanner;

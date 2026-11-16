import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExcelUpdateApplyDto } from 'shared';
import { excelUpdateService } from '../services/excelUpdateService';

const latestKey = (invoiceId: string) => ['invoices', 'excel-update', invoiceId] as const;

export function useExcelUpdatePreview(invoiceId: string) {
  return useMutation({ mutationFn: (file: File) => excelUpdateService.preview(invoiceId, file) });
}

/** The invoice, the invoice list, its payments' balance and the undo banner all change when the lines do. */
function useRefresh(invoiceId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['invoices'] });
    void qc.invalidateQueries({ queryKey: ['payments', 'invoice', invoiceId] });
    void qc.invalidateQueries({ queryKey: ['payments', 'statement'] });
  };
}

export function useApplyExcelUpdate(invoiceId: string) {
  const refresh = useRefresh(invoiceId);
  return useMutation({ mutationFn: (dto: ExcelUpdateApplyDto) => excelUpdateService.apply(invoiceId, dto), onSuccess: refresh });
}

export function useUndoExcelUpdate(invoiceId: string) {
  const refresh = useRefresh(invoiceId);
  return useMutation({ mutationFn: () => excelUpdateService.undo(invoiceId), onSuccess: refresh });
}

export function useLatestExcelUpdate(invoiceId: string, enabled = true) {
  return useQuery({ queryKey: latestKey(invoiceId), queryFn: () => excelUpdateService.latest(invoiceId), enabled });
}

import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { invoiceService } from '../services/invoiceService';

type Kind = 'pdf' | 'excel' | 'print';

/** Download or print an invoice's documents, with one in-flight action at a time and a toast for every outcome. */
export function useInvoiceDocuments() {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(async (kind: Kind, id: string, task: () => Promise<void>, success: { title: string; message: string } | null) => {
    setBusy(`${kind}:${id}`);
    try {
      await task();
      if (success) showToast(success.title, success.message, 'success');
    } catch (error) {
      const what = kind === 'print' ? 'print' : kind === 'pdf' ? 'download the PDF' : 'download the Excel file';
      showToast(`Couldn't ${what}`, error instanceof Error ? error.message : 'Please try again.', 'error');
    } finally {
      setBusy(null);
    }
  }, [showToast]);

  return {
    /** "pdf:<id>" etc. while something is running, otherwise null. */
    busy,
    isBusy: busy !== null,
    downloadPdf: (id: string) => run('pdf', id, () => invoiceService.downloadPdf(id), { title: 'PDF ready', message: 'The invoice PDF was downloaded.' }),
    downloadExcel: (id: string) => run('excel', id, () => invoiceService.downloadExcel(id), { title: 'Excel ready', message: 'The invoice workbook was downloaded.' }),
    print: (id: string) => run('print', id, () => invoiceService.printPdf(id), null),
  };
}

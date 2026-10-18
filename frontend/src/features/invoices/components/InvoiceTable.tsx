import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../hooks/useInvoices';
import { useInvoiceStore } from '../store/invoiceStore';
import { useInvoiceDocuments } from '../hooks/useInvoiceDocuments';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FileDown } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import { INVOICES_TWO_COLUMNS_FROM, scrollMainToTop, usePageSize } from '@/lib/pagination';
import InvoiceCard from './InvoiceCard';
import ShareInvoiceDialog, { toShareable, type ShareableInvoice } from './ShareInvoiceDialog';
import { useCreateActualInvoice, useDeleteInvoice } from '../hooks/useInvoices';
import { useConfirm } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';

export default function InvoiceTable() {
  const { search, filters, page, setPage, openEditForm, clearFilters } = useInvoiceStore();
  const pageSize = usePageSize(INVOICES_TWO_COLUMNS_FROM);
  const { data, isLoading, isError } = useInvoices({
    ...(search ? { search } : {}),
    ...(filters.year ? { year: Number(filters.year) } : {}),
    ...(filters.month ? { month: Number(filters.month) } : {}),
    ...(filters.importerId ? { importerId: filters.importerId } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
    page,
    limit: pageSize,
  });

  // A different screen size means different page boundaries, so start again from page 1.
  const lastPageSize = useRef(pageSize);
  useEffect(() => {
    if (lastPageSize.current !== pageSize) {
      lastPageSize.current = pageSize;
      setPage(1);
    }
  }, [pageSize, setPage]);

  // If the last card on the last page was just deleted, step back to the new last page.
  const totalPages = data?.meta?.totalPages ?? 0;
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);

  const changePage = (next: number) => {
    setPage(next);
    scrollMainToTop();
  };
  const isFiltering = search !== '' || Object.values(filters).some((v) => v !== '');
  const deleteMutation = useDeleteInvoice();
  const navigate = useNavigate();
  const documents = useInvoiceDocuments();
  const [sharing, setSharing] = useState<ShareableInvoice | null>(null);
  const confirm = useConfirm();
  const createActualMutation = useCreateActualInvoice();
  const { showToast } = useToast();
  const askCreateActual = async (id: string, invoiceNumber: string) => {
    const ok = await confirm({
      title: `Create the actual invoice for ${invoiceNumber}?`,
      message: `A full copy named ACTUAL ${invoiceNumber} is created with all the same details. Only one actual invoice can be made from an invoice.`,
      confirmLabel: 'Create actual invoice',
    });
    if (!ok) return;
    try {
      await createActualMutation.mutateAsync(id);
      showToast('Actual invoice created', `ACTUAL ${invoiceNumber} is ready.`, 'success');
    } catch (error) {
      showToast("Couldn't create the actual invoice", error instanceof Error ? error.message : 'Please try again.', 'error');
    }
  };
  const askDelete = async (id: string, invoiceNumber: string) => {
    const ok = await confirm({
      title: `Delete invoice ${invoiceNumber}?`,
      message: 'The invoice moves to the Recycle Bin, where you can restore it.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) deleteMutation.mutate(id);
  };
  const openInvoice = (id: string) => navigate(`/invoices/${id}`);

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (isError) return <div className="text-center py-16 text-destructive">Failed to load invoices.</div>;

  const invoices = data?.data ?? [];
  const meta = data?.meta;

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
          <FileDown className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-semibold text-foreground">{isFiltering ? 'No invoices match your search or filters' : 'No invoices found'}</p>
        <p className="text-xs text-muted-foreground mt-1">{isFiltering ? 'Try a different year, month, importer or currency.' : 'Create your first invoice to get started.'}</p>
        {isFiltering && <button onClick={clearFilters} className="mt-3 text-sm font-semibold underline">Clear search and filters</button>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {invoices.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            deleting={deleteMutation.isPending}
            onOpen={() => openInvoice(invoice.id)}
            documentsBusy={documents.isBusy}
            onPrint={() => documents.print(invoice.id)}
            onShare={() => setSharing(toShareable(invoice))}
            onCreateActual={() => askCreateActual(invoice.id, invoice.invoiceNumber)}
            creatingActual={createActualMutation.isPending}
            onPdf={() => documents.downloadPdf(invoice.id)}
            onExcel={() => documents.downloadExcel(invoice.id)}
            onEdit={() => openEditForm(invoice.id)}
            onDelete={() => askDelete(invoice.id, invoice.invoiceNumber)}
          />
        ))}
      </div>

      {meta && (
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.limit} onPageChange={changePage} noun="invoices" />
      )}
      {sharing && <ShareInvoiceDialog invoice={sharing} onClose={() => setSharing(null)} />}
    </div>
  );
}

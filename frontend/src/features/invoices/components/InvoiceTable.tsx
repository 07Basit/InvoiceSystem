import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../hooks/useInvoices';
import { useInvoiceStore } from '../store/invoiceStore';
import { invoiceService } from '../services/invoiceService';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FileDown, ChevronLeft, ChevronRight } from 'lucide-react';
import InvoiceCard from './InvoiceCard';
import { useDeleteInvoice } from '../hooks/useInvoices';
import { useConfirm } from '@/components/ui/confirm';

export default function InvoiceTable() {
  const { search, page, setPage, openEditForm } = useInvoiceStore();
  const { data, isLoading, isError } = useInvoices({
    search: search || undefined,
    page,
    limit: 20,
  });
  const deleteMutation = useDeleteInvoice();
  const navigate = useNavigate();
  const confirm = useConfirm();
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
        <p className="text-sm font-semibold text-foreground">No invoices found</p>
        <p className="text-xs text-muted-foreground mt-1">Create your first invoice to get started.</p>
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
            onPdf={() => invoiceService.downloadPdf(invoice.id)}
            onExcel={() => invoiceService.downloadExcel(invoice.id)}
            onEdit={() => openEditForm(invoice.id)}
            onDelete={() => askDelete(invoice.id, invoice.invoiceNumber)}
          />
        ))}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
          <span className="text-xs">
            Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(meta.page - 1)}
              disabled={!meta.hasPrev}
              className="btn-icon h-8 w-8 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 text-xs font-medium bg-secondary rounded-lg">
              {meta.page} / {meta.totalPages}
            </span>
            <button
              onClick={() => setPage(meta.page + 1)}
              disabled={!meta.hasNext}
              className="btn-icon h-8 w-8 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

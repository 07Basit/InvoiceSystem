import { useInvoices } from '../hooks/useInvoices';
import { useInvoiceStore } from '../store/invoiceStore';
import { invoiceService } from '../services/invoiceService';
import { formatDate } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FileDown, Download, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDeleteInvoice } from '../hooks/useInvoices';

export default function InvoiceTable() {
  const { search, page, setPage, openEditForm } = useInvoiceStore();
  const { data, isLoading, isError } = useInvoices({
    search: search || undefined,
    page,
    limit: 20,
  });
  const deleteMutation = useDeleteInvoice();

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (isError) return <div className="text-center py-16 text-destructive">Failed to load invoices.</div>;

  const invoices = data?.data ?? [];
  const meta = data?.meta;

  if (invoices.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        No invoices found. Create your first invoice!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice #</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Importer</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice Date</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono font-medium">{invoice.invoiceNumber}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{invoice.importer.name}</div>
                  <div className="text-xs text-muted-foreground">{invoice.currency}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(invoice.invoiceDate)}</td>
                <td className="px-4 py-3 text-right font-medium">{invoice.currency} {Number(invoice.total).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => invoiceService.downloadPdf(invoice.id)}
                      className="p-1.5 hover:bg-accent rounded-md transition-colors"
                      title="Download PDF"
                    >
                      <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => invoiceService.downloadExcel(invoice.id)}
                      className="p-1.5 hover:bg-accent rounded-md transition-colors"
                      title="Download Excel"
                    >
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => openEditForm(invoice.id)}
                      className="p-1.5 hover:bg-accent rounded-md transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete invoice ${invoice.invoiceNumber}?`)) {
                          deleteMutation.mutate(invoice.id);
                        }
                      }}
                      className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors"
                      title="Delete"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(meta.page - 1)}
              disabled={!meta.hasPrev}
              className="p-1 rounded-md hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>Page {meta.page} of {meta.totalPages}</span>
            <button
              onClick={() => setPage(meta.page + 1)}
              disabled={!meta.hasNext}
              className="p-1 rounded-md hover:bg-accent disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { useInvoices } from '../hooks/useInvoices';
import { useInvoiceStore } from '../store/invoiceStore';
import { invoiceService } from '../services/invoiceService';
import { formatDate } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FileDown, Download, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDeleteInvoice } from '../hooks/useInvoices';

function NotInRevenueTag({ currency }: { currency: string }) {
  return (
    <span
      title={`No exchange rate available for ${currency}, so this invoice is not counted in dashboard revenue. Open it to enter a rate.`}
      className="inline-block mt-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-1.5"
    >
      Not in revenue
    </span>
  );
}

export default function InvoiceTable() {
  const { search, page, setPage, openEditForm } = useInvoiceStore();
  const { data, isLoading, isError } = useInvoices({
    search: search || undefined,
    page,
    limit: 20,
  });
  const deleteMutation = useDeleteInvoice();
  const navigate = useNavigate();
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
      <div className="md:hidden space-y-2">
        {invoices.map((invoice) => (
          <div key={invoice.id} onClick={() => openInvoice(invoice.id)} className={`rounded-xl border p-4 space-y-3 cursor-pointer ${invoice.excludedFromRevenue ? 'bg-amber-50 border-amber-200' : 'bg-card'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link to={`/invoices/${invoice.id}`} onClick={(e) => e.stopPropagation()} className="font-mono font-semibold text-sm hover:underline">{invoice.invoiceNumber}</Link>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(invoice.invoiceDate)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{invoice.currency} {Number(invoice.total).toFixed(2)}</p>
                {invoice.excludedFromRevenue && <NotInRevenueTag currency={invoice.currency} />}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))] text-[10px] font-bold shrink-0">
                {invoice.importer.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">{invoice.importer.name}</p>
                <p className="text-xs text-muted-foreground">{invoice.currency}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => invoiceService.downloadPdf(invoice.id)}
                className="btn-icon h-8 w-8"
                title="Download PDF"
              >
                <FileDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => invoiceService.downloadExcel(invoice.id)}
                className="btn-icon h-8 w-8"
                title="Download Excel"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => openEditForm(invoice.id)}
                className="btn-icon h-8 w-8"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete invoice ${invoice.invoiceNumber}?`)) {
                    deleteMutation.mutate(invoice.id);
                  }
                }}
                className="btn-icon h-8 w-8 hover:text-destructive hover:bg-destructive/10"
                title="Delete"
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block rounded-xl border overflow-x-auto">
        <table className="table-enterprise">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Importer</th>
              <th>Invoice Date</th>
              <th className="text-right">Total</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} onClick={() => openInvoice(invoice.id)} className={`cursor-pointer ${invoice.excludedFromRevenue ? 'bg-amber-50' : ''}`}>
                <td className="font-mono font-semibold text-sm whitespace-nowrap">
                  <Link to={`/invoices/${invoice.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{invoice.invoiceNumber}</Link>
                </td>
                <td>
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))] text-[10px] font-bold shrink-0">
                      {invoice.importer.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{invoice.importer.name}</p>
                      <p className="text-xs text-muted-foreground">{invoice.currency}</p>
                    </div>
                  </div>
                </td>
                <td className="text-muted-foreground text-sm">{formatDate(invoice.invoiceDate)}</td>
                <td className="text-right font-semibold">
                  {invoice.currency} {Number(invoice.total).toFixed(2)}
                  {invoice.excludedFromRevenue && <div><NotInRevenueTag currency={invoice.currency} /></div>}
                </td>
                <td>
                  <div className="flex items-center justify-end gap-0.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => invoiceService.downloadPdf(invoice.id)}
                      className="btn-icon h-8 w-8"
                      title="Download PDF"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => invoiceService.downloadExcel(invoice.id)}
                      className="btn-icon h-8 w-8"
                      title="Download Excel"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openEditForm(invoice.id)}
                      className="btn-icon h-8 w-8"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete invoice ${invoice.invoiceNumber}?`)) {
                          deleteMutation.mutate(invoice.id);
                        }
                      }}
                      className="btn-icon h-8 w-8 hover:text-destructive hover:bg-destructive/10"
                      title="Delete"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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

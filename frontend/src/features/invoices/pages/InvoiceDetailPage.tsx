import { useParams, Link } from 'react-router-dom';
import { useInvoice } from '../hooks/useInvoices';
import { useInvoiceStore } from '../store/invoiceStore';
import { invoiceService } from '../services/invoiceService';
import { StatusBadge } from '../components/StatusBadge';
import InvoiceForm from '../components/InvoiceForm';
import { formatDate } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ArrowLeft, FileDown, Download, Pencil, Printer } from 'lucide-react';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useInvoice(id ?? '');
  const { openEditForm } = useInvoiceStore();

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (isError || !data?.data) return <div className="text-center py-16 text-destructive">Invoice not found.</div>;

  const invoice = data.data;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link to="/invoices" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono">{invoice.invoiceNumber}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={invoice.status} />
            <span className="text-sm text-muted-foreground">Created {formatDate(invoice.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            onClick={() => invoiceService.downloadPdf(invoice.id)}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent"
          >
            <FileDown className="h-4 w-4" /> PDF
          </button>
          <button
            onClick={() => invoiceService.downloadExcel(invoice.id)}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
          <button
            onClick={() => openEditForm(invoice.id)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
        </div>
      </div>

      {/* Client Card */}
      <div className="border rounded-lg p-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Invoice Header</h3>
        <p className="font-semibold">Exporter: {invoice.exporterName ?? '-'}</p>
        <p className="text-sm text-muted-foreground">Importer: {invoice.importer.name}</p>
        <p className="text-sm text-muted-foreground">Buyer: {invoice.buyerName ?? '-'}</p>
        <p className="text-sm">Currency: {invoice.currency}</p>
      </div>

      {/* Line Items */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Kgs/Box</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Boxes</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Rate/Kgs</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoice.lineItems.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.descriptionOfGoods}</td>
                <td className="px-4 py-3 text-right">{Number(item.netWeightPerPackage).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{item.numberOfBoxes}</td>
                <td className="px-4 py-3 text-right">{invoice.currency} {Number(item.ratePerKg).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-medium">{invoice.currency} {Number(item.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-4 border-t space-y-1.5 text-sm">
          <div className="flex justify-end gap-16 text-muted-foreground">
            <span>Total Net Weight</span><span>{Number(invoice.totalNetWeight).toFixed(2)} KGS</span>
          </div>
          <div className="flex justify-end gap-16 text-muted-foreground">
            <span>Sub Total</span><span>{invoice.currency} {Number(invoice.subTotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-end gap-16 text-muted-foreground">
            <span>Round Off</span><span>{invoice.currency} {Number(invoice.roundOff).toFixed(2)}</span>
          </div>
          <div className="flex justify-end gap-16 font-semibold text-base">
            <span>Total</span><span>{invoice.currency} {Number(invoice.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="border rounded-lg p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
          <p className="text-sm">{invoice.notes}</p>
        </div>
      )}

      <InvoiceForm />
    </div>
  );
}

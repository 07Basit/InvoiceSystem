import { useInvoiceStore } from '../store/invoiceStore';
import { invoiceService } from '../services/invoiceService';
import InvoiceTable from '../components/InvoiceTable';
import InvoiceForm from '../components/InvoiceForm';
import { Plus, Download, Search } from 'lucide-react';

export default function InvoicesPage() {
  const { search, openCreateForm, setSearch } = useInvoiceStore();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and track all your invoices</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={invoiceService.exportAll}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Table */}
      <InvoiceTable />

      {/* Form Modal */}
      <InvoiceForm />
    </div>
  );
}

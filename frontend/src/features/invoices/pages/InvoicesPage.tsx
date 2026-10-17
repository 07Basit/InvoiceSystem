import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CreateInvoiceDto } from 'shared';
import { useInvoiceStore } from '../store/invoiceStore';
import { invoiceService } from '../services/invoiceService';
import InvoiceTable from '../components/InvoiceTable';
import InvoiceForm from '../components/InvoiceForm';
import { Plus, Download, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import InvoiceStats from '../components/InvoiceStats';
import InvoiceFilters from '../components/InvoiceFilters';
import { useClients } from '@/features/clients/hooks/useClients';
import Tooltip from '@/components/ui/Tooltip';
import { useInvoiceSummary } from '../hooks/useInvoices';

const invoiceDraftListKey = 'invoice-draft-list-v1';

interface InvoiceDraft {
  id: string;
  createdAt: string;
  data: CreateInvoiceDto;
}

function readInvoiceDrafts() {
  try {
    const raw = localStorage.getItem(invoiceDraftListKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InvoiceDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function InvoicesPage() {
  const { search, filters, openCreateForm, openDraftForm, setSearch, setFilter, clearFilters } = useInvoiceStore();
  const { data: importersData } = useClients({ limit: 100, sort: 'name' });
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState<InvoiceDraft[]>(() => readInvoiceDrafts());
  const { data: summary } = useInvoiceSummary();

  // The top bar's "New invoice" arrives as /invoices?new=1: open the form once and tidy the URL
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openCreateForm();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, openCreateForm]);

  useEffect(() => {
    const handleDraftUpdate = () => setDrafts(readInvoiceDrafts());
    window.addEventListener('invoice-drafts-updated', handleDraftUpdate);
    return () => window.removeEventListener('invoice-drafts-updated', handleDraftUpdate);
  }, []);

  const deleteDraft = (draftId: string) => {
    const next = drafts.filter((item) => item.id !== draftId);
    setDrafts(next);
    localStorage.setItem(invoiceDraftListKey, JSON.stringify(next));
    window.dispatchEvent(new Event('invoice-drafts-updated'));
    showToast('Draft deleted', 'Invoice draft was removed.', 'info');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and track all your invoices</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
          <button
            onClick={invoiceService.exportAll}
            className="btn-ghost text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <button
            onClick={openCreateForm}
            className="btn-brand text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New Invoice
          </button>
        </div>
      </div>

      {summary?.data && <InvoiceStats summary={summary.data} />}

      {drafts.length > 0 ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Saved Drafts
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
              {drafts.length}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {drafts.map((draft) => (
              <div key={draft.id} className="border border-amber-200 rounded-xl p-4 bg-amber-50/50 space-y-3 hover:border-amber-300 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-bold">Draft</span>
                    <p className="font-semibold mt-2 text-sm">{draft.data.invoiceNumber || 'Untitled Draft Invoice'}</p>
                    <p className="text-xs text-muted-foreground">Currency: {draft.data.currency || '—'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tooltip label="Edit draft" align="end">
                      <button onClick={() => openDraftForm(draft.id, draft.data)} className="btn-icon h-7 w-7" aria-label="Edit draft">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip label="Delete draft" align="end">
                      <button onClick={() => deleteDraft(draft.id)} className="btn-icon h-7 w-7 hover:text-destructive" aria-label="Delete draft">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <div className="text-xs space-y-1 text-muted-foreground">
                  <p>Importer ID: {draft.data.importerId || '—'}</p>
                  <p>Date: {draft.data.invoiceDate ? new Date(draft.data.invoiceDate).toLocaleDateString() : '—'}</p>
                </div>

                <p className="text-[10px] text-muted-foreground border-t border-amber-200/60 pt-2">
                  Saved {new Date(draft.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <InvoiceFilters
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilter}
        onClear={clearFilters}
        years={summary?.data?.years ?? []}
        currencies={summary?.data?.currencies ?? []}
        importers={importersData?.data ?? []}
      />

      <InvoiceTable />

      <InvoiceForm />
    </div>
  );
}

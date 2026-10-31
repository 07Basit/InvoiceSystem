import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import FilterBar from '@/components/ui/FilterBar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import { useConfirm } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import PurchaseFilterPanel from '../components/PurchaseFilterPanel';
import { usePurchases, useSupplierMutations, useSuppliers } from '../hooks/usePurchases';
import { dateLabel, inr, plainNumber, titleCase } from '../utils/format';
import { countActive, noPurchaseFilters, type PurchaseFilterValues } from '../utils/purchaseFilters';

const PAGE_SIZE = 20;

/** The purchase invoices of one supplier (or all of them), newest first, with the same search and filters as the invoices. */
export default function PurchaseListPage() {
  const navigate = useNavigate();
  const { supplier = 'all' } = useParams();
  const { data: suppliers = [] } = useSuppliers();
  const { remove } = useSupplierMutations();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const supplierId = supplier === 'all' ? '' : supplier;
  const [filters, setFilters] = useState<PurchaseFilterValues>(noPurchaseFilters);
  const [panelOpen, setPanelOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const debouncedProduct = useDebouncedValue(filters.product.trim(), 300);
  const effectiveSupplier = supplierId || filters.supplierId;
  const current = suppliers.find((s) => s.id === supplierId);
  const supplierName = current?.name;
  const invoiceCount = current?._count?.purchases ?? 0;

  const deleteSupplier = async () => {
    if (!current) return;
    const ok = await confirm({ title: `Delete ${titleCase(current.name)}?`, message: 'The supplier is removed from your list. This cannot be undone.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    remove.mutate(current.id, {
      onSuccess: () => { showToast('Supplier deleted', `${titleCase(current.name)} was removed.`, 'success'); navigate('/purchases'); },
      onError: (err) => showToast('Could not delete', err.message, 'error'),
    });
  };

  const { dateFrom, dateTo, basis } = filters;
  const { data, isLoading, isError, refetch } = usePurchases({
    page,
    limit: PAGE_SIZE,
    sort: basis === 'purchase' ? 'purchaseDate' : 'invoiceDate',
    ...(effectiveSupplier ? { supplierId: effectiveSupplier } : {}),
    ...(basis === 'invoice' ? { ...(dateFrom ? { invoiceFrom: dateFrom } : {}), ...(dateTo ? { invoiceTo: dateTo } : {}) } : { ...(dateFrom ? { purchaseFrom: dateFrom } : {}), ...(dateTo ? { purchaseTo: dateTo } : {}) }),
    ...(debouncedProduct ? { product: debouncedProduct } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });
  const rows = data?.rows ?? [];
  const meta = data?.meta;
  const filtered = Boolean(countActive(filters) || debouncedSearch);
  const change = (next: PurchaseFilterValues) => { setFilters(next); setPage(1); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/purchases" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Purchase invoices</Link>
          <h1 className="text-2xl font-bold">{supplierId ? `${titleCase(supplierName ?? 'Supplier')} Purchase Invoices` : 'All Purchase Invoices'}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {current && (
            <button type="button" onClick={() => void deleteSupplier()} disabled={invoiceCount > 0 || remove.isPending}
              title={invoiceCount > 0 ? `Delete its ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'} first` : 'Delete this supplier'}
              className="btn-ghost text-destructive hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-4 w-4" /> Delete supplier</button>
          )}
          <button type="button" onClick={() => navigate('/purchases/new')} className="btn-ghost"><Plus className="h-4 w-4" /> Enter by hand</button>
        </div>
      </div>

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search invoice number…"
        searchLabel="Search invoice number"
        activeCount={countActive(filters)}
        onClear={() => { setSearch(''); change(noPurchaseFilters); }}
        onOpenFilters={() => setPanelOpen(true)}
      />
      <PurchaseFilterPanel open={panelOpen} onClose={() => setPanelOpen(false)} filters={filters} onChange={change} suppliers={suppliers} show={{ basis: true, product: true, supplier: !supplierId }} matching={meta?.total} />

    <section aria-label="Purchase invoices" className="card-enterprise">
      {isLoading ? (
        <div className="py-16"><LoadingSpinner variant="invoices" size="sm" /></div>
      ) : isError ? (
        <div className="px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">The purchase invoices could not be loaded.</p>
          <button type="button" onClick={() => void refetch()} className="btn-ghost mt-3">Try again</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <h3 className="text-base font-semibold">{filtered ? 'No purchase invoices match' : 'No purchase invoices yet'}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{filtered ? 'Try other filters.' : 'Upload an Excel invoice from a supplier, or enter one by hand.'}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Supplier</th>
                  <th className="px-3 py-2.5 font-semibold">Invoice no.</th>
                  <th className="px-3 py-2.5 font-semibold">Invoice date</th>
                  <th className="px-3 py-2.5 font-semibold">Purchase date</th>
                  <th className="px-3 py-2.5 font-semibold">Products</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Net weight</th>
                  <th className="px-4 py-2.5 text-right font-semibold sm:px-5">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const names = [...new Set(p.lines.map((l) => l.productName))];
                  const kilos = p.lines.reduce((sum, l) => sum + (l.netWeight ?? 0), 0);
                  return (
                    <tr key={p.id} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50" onClick={() => navigate(`/purchases/${p.id}`)}>
                      <td className="px-4 py-2.5 font-medium sm:px-5">{p.supplierName}</td>
                      <td className="px-3 py-2.5"><button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${p.id}`); }} className="font-mono text-xs hover:underline">{p.invoiceNumber}</button></td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{dateLabel(p.invoiceDate)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{dateLabel(p.purchaseDate)}</td>
                      <td className="max-w-[16rem] truncate px-3 py-2.5 text-muted-foreground" title={names.join(', ')}>{names.slice(0, 3).join(', ')}{names.length > 3 ? ` +${names.length - 3}` : ''}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground">{kilos ? `${plainNumber(kilos)} KGS` : '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold sm:px-5">{inr(p.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 sm:px-5">
            <Pagination page={meta?.page ?? 1} totalPages={meta?.totalPages ?? 1} total={meta?.total ?? rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} noun="purchase invoices" />
          </div>
        </>
      )}
    </section>
    </div>
  );
}
